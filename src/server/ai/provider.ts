import { ANTHROPIC_API_KEY, GEMINI_API_KEY } from "../config";
import { generateAnthropicStream, generateAnthropicText } from "./anthropic";
import { genAI, generateGeminiStream, generateGeminiText } from "./gemini";

// Provider router. Anthropic takes precedence when configured, with Gemini as fallback.

export async function generateModelStream(prompt: string | string[]) {
  if (ANTHROPIC_API_KEY) return await generateAnthropicStream(prompt);
  if (GEMINI_API_KEY && genAI) return await generateGeminiStream(prompt);
  throw new Error("No AI provider configured");
}

export async function generateModelText(prompt: string | string[]): Promise<string> {
  if (ANTHROPIC_API_KEY) return await generateAnthropicText(prompt);
  if (GEMINI_API_KEY && genAI) return await generateGeminiText(prompt);
  throw new Error("No AI provider configured");
}
