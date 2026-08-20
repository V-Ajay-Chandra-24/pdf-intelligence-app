export interface LLMProvider {
  summarize(text: string): Promise<string>;
  chatStream(messages: { role: string; content: string }[]): Promise<Response>;
}

import { ollamaProvider } from "./providers/ollama";
import { geminiProvider } from "./providers/gemini";

function getProvider(): LLMProvider {
  console.log("--- LLM PROVIDER SELECTION ---");
  console.log("process.env.LLM_PROVIDER is:", process.env.LLM_PROVIDER);
  
  if (process.env.LLM_PROVIDER === "gemini") {
    console.log("Using Gemini Provider");
    return geminiProvider;
  }
  
  console.log("Using Ollama Provider (Fallback)");
  return ollamaProvider;
}

export const llm: LLMProvider = {
  summarize: (text: string) => getProvider().summarize(text),
  chatStream: (messages: { role: string; content: string }[]) => getProvider().chatStream(messages),
};
