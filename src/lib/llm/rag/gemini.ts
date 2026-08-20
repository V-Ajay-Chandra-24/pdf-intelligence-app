import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const GEMINI_EMBED_MODEL = process.env.GEMINI_EMBED_MODEL || "gemini-embedding-001";

export async function embedTextGemini(text: string): Promise<number[]> {
  try {
    const result = await ai.models.embedContent({
      model: GEMINI_EMBED_MODEL,
      contents: text, // Or [text] depending on how the SDK strictly typed it, but string works per doc
      config: { 
        outputDimensionality: 768 
      },
    });

    if (!result.embeddings || result.embeddings.length === 0 || !result.embeddings[0].values) {
      throw new Error("Failed to generate embedding array from Gemini");
    }

    return result.embeddings[0].values;
  } catch (err: any) {
    console.error("Gemini embedding error:", err);
    throw new Error(`Gemini embedding failed: ${err.message || "Unknown error"}`);
  }
}
