import { LLMProvider } from "../index";

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://host.docker.internal:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "gemma3:4b";

export const ollamaProvider: LLMProvider = {
  summarize: async (text: string): Promise<string> => {
    // Truncate to approx 6000 tokens (roughly 24,000 chars) to prevent context window overflow
    const MAX_CHARS = 24000;
    const truncatedText = text.length > MAX_CHARS ? text.substring(0, MAX_CHARS) + "...\n[TRUNCATED FOR LENGTH]" : text;

    const systemPrompt = `You are summarizing a document for someone who has not read it. Write a 3-5 sentence summary that captures the specific, concrete content of the document — key facts, figures, names, decisions, or conclusions — not a vague description of what "type" of document it is.

Rules:
- Do NOT start with phrases like "This document is about..." or "This is a PDF that discusses..." — get straight to the substance.
- Prioritize specific details (numbers, dates, names, amounts, outcomes) over generic categorization.
- If the document is a form, memo, resume, or certificate, state the specific purpose and key details it contains (e.g. who it's for, what it certifies, what values it lists) rather than just naming the document type.
- Do not add information that isn't in the text. Do not speculate.
- Write in plain, direct sentences. No bullet points, no headers, no preamble.`;

    const userPrompt = `Document text:\n${truncatedText}`;

    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), 60000); // 60s timeout

    try {
      const response = await fetch(`${OLLAMA_BASE_URL}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          max_tokens: 200,
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama API error: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content?.trim() || "";
    } finally {
      clearTimeout(timeout);
    }
  },

  chatStream: async (messages: { role: string; content: string }[]): Promise<Response> => {
    // Send request to Ollama's OpenAI compatible endpoint with stream: true
    const response = await fetch(`${OLLAMA_BASE_URL}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API error: ${response.status} ${errorText}`);
    }

    return response;
  },
};
