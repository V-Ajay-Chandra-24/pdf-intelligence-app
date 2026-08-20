import prisma from "@/lib/prisma";

import { embedTextGemini } from "./gemini";

// Reusable embedding function calling Ollama's /api/embeddings
export async function embedTextOllama(text: string): Promise<number[]> {
  const baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
  
  // Use nomic-embed-text for 768-dimensional embeddings
  const response = await fetch(`${baseUrl}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "nomic-embed-text",
      prompt: text,
    }),
  });

  if (!response.ok) {
    throw new Error(`Embedding failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data.embedding;
}

export async function embedText(text: string): Promise<number[]> {
  if (process.env.LLM_PROVIDER === "gemini") {
    return await embedTextGemini(text);
  }
  return await embedTextOllama(text);
}

// Simple chunking based on characters (approx 2000 chars ~ 500 tokens, 400 char overlap)
export function chunkText(text: string, chunkSize = 2000, overlap = 400): string[] {
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + chunkSize));
    i += chunkSize - overlap;
  }
  return chunks;
}

// Embeds document text and inserts chunks into DB
export async function setupDocumentRAG(documentId: string, text: string): Promise<void> {
  // Check if chunks already exist
  const existingChunks = await prisma.documentChunk.count({
    where: { documentId },
  });

  if (existingChunks > 0) return; // Already processed

  const chunks = chunkText(text);

  // We embed and insert chunks one by one or in batches to avoid overloading Ollama
  for (let i = 0; i < chunks.length; i++) {
    const content = chunks[i];
    try {
      const embedding = await embedText(content);
      
      // We must use $executeRaw because Prisma Client doesn't support writing to Unsupported vector columns directly
      await prisma.$executeRaw`
        INSERT INTO "DocumentChunk" ("id", "documentId", "chunkIndex", "content", "embedding")
        VALUES (gen_random_uuid(), ${documentId}, ${i}, ${content}, ${embedding}::vector)
      `;
    } catch (e) {
      console.error(`Failed to embed chunk ${i} for document ${documentId}`, e);
    }
  }
}

// Retrieves the most relevant context for a question
export async function retrieveContext(documentId: string, question: string): Promise<string> {
  const questionEmbedding = await embedText(question);

  // Cosine similarity search using pgvector (<=>)
  // Ordered by distance, closest first
  const similarChunks = await prisma.$queryRaw<{ content: string }[]>`
    SELECT content
    FROM "DocumentChunk"
    WHERE "documentId" = ${documentId}
    ORDER BY embedding <=> ${questionEmbedding}::vector
    LIMIT 6
  `;

  if (!similarChunks || similarChunks.length === 0) return "";

  return similarChunks.map((chunk) => chunk.content).join("\n\n---\n\n");
}
