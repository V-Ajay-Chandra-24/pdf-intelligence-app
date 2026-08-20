import { GoogleGenAI } from "@google/genai";
import { LLMProvider } from "../index";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const GEMINI_CHAT_MODEL = process.env.GEMINI_CHAT_MODEL || "gemini-3.6-flash";

export const geminiProvider: LLMProvider = {
  summarize: async (text: string): Promise<string> => {
    // Truncate to approx 800,000 tokens (roughly 3,000,000 chars) to prevent context window overflow
    // Gemini 1.5 Pro and Flash have large windows, but let's place a very safe ceiling.
    const MAX_CHARS = 3000000;
    const truncatedText = text.length > MAX_CHARS ? text.substring(0, MAX_CHARS) + "...\n[TRUNCATED FOR LENGTH]" : text;

    const systemPrompt = `You are summarizing a document for someone who has not read it. Write a 3-5 sentence summary that captures the specific, concrete content of the document — key facts, figures, names, decisions, or conclusions — not a vague description of what "type" of document it is.

Rules:
- Do NOT start with phrases like "This document is about..." or "This is a PDF that discusses..." — get straight to the substance.
- Do NOT include any preamble, introduction, or meta-commentary about the summary itself (e.g. "Here's a summary of...", "This document covers...") — output only the summary content directly.
- Prioritize specific details (numbers, dates, names, amounts, outcomes) over generic categorization.
- If the document is a form, memo, resume, or certificate, state the specific purpose and key details it contains (e.g. who it's for, what it certifies, what values it lists) rather than just naming the document type.
- Do not add information that isn't in the text. Do not speculate.
- Write in plain, direct sentences. No bullet points, no headers, no preamble.`;

    const userPrompt = `Document text:\n${truncatedText}`;

    console.log("--- GEMINI SUMMARIZE PAYLOAD ---");
    console.log("System Prompt:", systemPrompt);
    console.log("User Prompt (truncated):", userPrompt.substring(0, 200) + "...");

    try {
      const response = await ai.models.generateContent({
        model: GEMINI_CHAT_MODEL,
        contents: userPrompt,
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.3,
          maxOutputTokens: 8192,
        },
      });
      const rawOutput = response.text?.trim() || "";
      console.log("--- GEMINI RAW OUTPUT ---");
      console.log(rawOutput);
      return rawOutput;
    } catch (err: any) {
      console.error("Gemini API error during summarization:", err);
      // Handle known error formats cleanly
      if (err.status === 429) {
        throw new Error("Gemini API error: Rate limit exceeded (429)");
      }
      throw new Error(`Gemini API error: ${err.message || "Unknown error"}`);
    }
  },

  chatStream: async (messages: { role: string; content: string }[]): Promise<Response> => {
    try {
      // Extract system message
      const systemMessage = messages.find(m => m.role === "system")?.content;
      
      // Map history to Gemini's expected format, excluding the system prompt
      const history = messages
        .filter(m => m.role !== "system")
        .map(msg => ({
          role: msg.role === "user" ? "user" : "model",
          parts: [{ text: msg.content }]
        }));

      // The SDK generateContentStream expects a single 'contents' array or string
      const stream = await ai.models.generateContentStream({
        model: GEMINI_CHAT_MODEL,
        contents: history,
        config: {
          systemInstruction: systemMessage,
        },
      });

      // We wrap the AsyncGenerator into a standard Web ReadableStream.
      // This stream emits exact SSE chunks mimicking the OpenAI/Ollama format,
      // so the existing route parser in `route.ts` doesn't need to change.
      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of stream) {
              if (chunk.text) {
                const payload = {
                  choices: [
                    {
                      delta: { content: chunk.text }
                    }
                  ]
                };
                controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`));
              }
            }
            controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
            controller.close();
          } catch (err) {
            console.error("Stream processing error (Gemini):", err);
            controller.error(err);
          }
        }
      });

      return new Response(readableStream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive"
        }
      });
    } catch (err: any) {
      console.error("Gemini API error during chatStream:", err);
      if (err.status === 429) {
        throw new Error("Gemini API error: Rate limit exceeded (429)");
      }
      throw new Error(`Gemini API error: ${err.message || "Unknown error"}`);
    }
  },
};
