import { NextResponse as Response, NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { setupDocumentRAG, retrieveContext } from "@/lib/llm/rag";
import { llm } from "@/lib/llm";
import { verifyDocumentAccess } from "@/lib/access";

// Simple in-memory rate limiter: { token: { count, resetAt } }
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 5; // 5 messages
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute

export async function POST(req: NextRequest, { params }: { params: Promise<{ documentId: string }> }) {
  try {
    const { documentId } = await params;
    const shareToken = req.headers.get("X-Share-Token");

    // Rate Limiting for guests
    if (shareToken) {
      const now = Date.now();
      const limit = rateLimitMap.get(shareToken);

      if (limit && now < limit.resetAt) {
        if (limit.count >= RATE_LIMIT_MAX) {
          return Response.json({ message: "Rate limit exceeded. Please wait a moment." }, { status: 429 });
        }
        limit.count++;
      } else {
        rateLimitMap.set(shareToken, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
      }
    }

    const accessCheck = await verifyDocumentAccess(documentId, shareToken);
    if (!accessCheck.authorized) {
      return Response.json({ message: accessCheck.message }, { status: accessCheck.status });
    }

    const guestSessionId = req.headers.get("X-Guest-Session-Id");
    let participantKey: string;
    
    if (accessCheck.access === "owner") {
      participantKey = accessCheck.user.id;
    } else {
      if (!guestSessionId) {
        return Response.json({ message: "Guest session ID is required for chat." }, { status: 400 });
      }
      participantKey = guestSessionId;
    }

    const document = accessCheck.document;

    const body = await req.json();
    const { question } = body;

    if (!question) {
      return Response.json({ message: "Question is required" }, { status: 400 });
    }

    // 1. Save user question to DB
    await prisma.chatMessage.create({
      data: {
        documentId,
        participantKey,
        role: "user",
        content: question,
      },
    });

    // 2. Fetch history (last 10 messages = 5 turns)
    const history = await prisma.chatMessage.findMany({
      where: { documentId, participantKey },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    // Reverse to chronological order
    history.reverse();

    // 3. Hybrid Context Strategy
    const text = document.extractedText || "";
    const estimatedTokens = text.length / 4;
    
    // Determine provider-specific threshold
    const provider = process.env.LLM_PROVIDER || "ollama";
    let threshold = 5000;
    
    if (provider === "gemini" && process.env.FULL_CONTEXT_TOKEN_THRESHOLD_GEMINI) {
      threshold = parseInt(process.env.FULL_CONTEXT_TOKEN_THRESHOLD_GEMINI, 10);
    } else if (process.env.FULL_CONTEXT_TOKEN_THRESHOLD_OLLAMA) {
      threshold = parseInt(process.env.FULL_CONTEXT_TOKEN_THRESHOLD_OLLAMA, 10);
    }

    const isRagMode = estimatedTokens > threshold;

    let contextText = "";
    if (isRagMode) {
      // Ensure chunks exist (only embeds if missing)
      await setupDocumentRAG(documentId, text);
      contextText = await retrieveContext(documentId, question);
    } else {
      contextText = text;
    }

    // 4. Build prompt and messages
    const systemPrompt = `You are a helpful assistant answering questions about a provided document. 
You MUST answer ONLY based on the provided document context below. 
If the answer cannot be found in the context, explicitly state "I couldn't find that in the document" instead of guessing or using outside knowledge.

--- DOCUMENT CONTEXT ---
${contextText}`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...history.map((msg) => ({ role: msg.role, content: msg.content })),
    ];

    // 5. Call LLM Streaming
    console.log("--- CHAT ROUTE DEBUG ---");
    console.log("process.env.LLM_PROVIDER inside chat route is:", process.env.LLM_PROVIDER);
    const ollamaResponse = await llm.chatStream(messages);
    if (!ollamaResponse.body) {
      throw new Error("No response body from LLM");
    }

    // We create a custom ReadableStream to parse OpenAI SSE chunks,
    // yield plain text to the client, and collect the full string to save to the DB.
    const reader = ollamaResponse.body.getReader();
    const decoder = new TextDecoder();
    let fullAssistantResponse = "";
    let isStreamActive = true;

    // Background function to drain the stream if client disconnects
    const drainStreamAndSave = async () => {
      try {
        while (isStreamActive) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ") && line !== "data: [DONE]") {
              try {
                const parsed = JSON.parse(line.slice(6));
                const content = parsed.choices[0]?.delta?.content || "";
                fullAssistantResponse += content;
              } catch (e) {
                // partial JSON chunk, ignore
              }
            }
          }
        }
      } catch (err) {
        console.error("Error draining stream:", err);
      } finally {
        if (fullAssistantResponse.trim().length > 0) {
          await prisma.chatMessage.create({
            data: {
              documentId,
              participantKey,
              role: "assistant",
              content: fullAssistantResponse,
            },
          });
        }
      }
    };

    const clientStream = new ReadableStream({
      async pull(controller) {
        try {
          const { done, value } = await reader.read();
          if (done) {
            isStreamActive = false;
            controller.close();
            // Stream finished naturally, save to DB
            drainStreamAndSave();
            return;
          }
          
          // Decode the chunk for parsing and also send it to the client
          const chunkStr = decoder.decode(value, { stream: true });
          const lines = chunkStr.split("\n");
          
          let clientChunk = "";
          for (const line of lines) {
            if (line.startsWith("data: ") && line !== "data: [DONE]") {
              try {
                const parsed = JSON.parse(line.slice(6));
                const content = parsed.choices[0]?.delta?.content || "";
                fullAssistantResponse += content;
                clientChunk += content;
              } catch (e) {
                // ignore
              }
            }
          }

          if (clientChunk) {
            controller.enqueue(new TextEncoder().encode(clientChunk));
          }
        } catch (error) {
          console.error("Stream reading error:", error);
          isStreamActive = false;
          controller.error(error);
          drainStreamAndSave();
        }
      },
      cancel() {
        // If the client disconnects, we just let pull() stop being called,
        // but we drain the rest of the stream in the background!
        drainStreamAndSave();
      }
    });

    return new Response(clientStream, {
      headers: {
        "Content-Type": "text/plain",
        "Transfer-Encoding": "chunked",
        "X-Context-Mode": isRagMode ? "RAG" : "FULL",
      },
    });

  } catch (error: any) {
    console.error("Chat API error:", error);
    if (error.message && error.message.includes("429")) {
      return Response.json({ message: "Rate limit reached — please wait a moment and try again." }, { status: 429 });
    }
    return Response.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ documentId: string }> }) {
  try {
    const { documentId } = await params;
    const shareToken = req.headers.get("X-Share-Token");

    const accessCheck = await verifyDocumentAccess(documentId, shareToken);
    if (!accessCheck.authorized) {
      return Response.json({ message: accessCheck.message }, { status: accessCheck.status });
    }

    const guestSessionId = req.headers.get("X-Guest-Session-Id");
    let participantKey: string;
    
    if (accessCheck.access === "owner") {
      participantKey = accessCheck.user.id;
    } else {
      if (!guestSessionId) {
        return Response.json({ message: "Guest session ID is required for chat." }, { status: 400 });
      }
      participantKey = guestSessionId;
    }

    const history = await prisma.chatMessage.findMany({
      where: { documentId, participantKey },
      orderBy: { createdAt: "asc" },
    });

    return Response.json({ history }, { status: 200 });
  } catch (error) {
    console.error("GET chat error:", error);
    return Response.json({ message: "Internal server error" }, { status: 500 });
  }
}
