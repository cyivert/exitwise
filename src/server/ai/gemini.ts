import { GoogleGenerativeAI } from "@google/generative-ai";
import { GEMINI_API_KEY } from "../config";

// Lazily instantiate the Gemini client. null when the API key is unset.
export const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

// Models tried in order. The first that does not throw wins.
const MODEL_FALLBACKS = ["gemini-2.5-flash", "gemini-2.0-flash"];

// Stream a Gemini response. Falls back through the model list on errors.
export async function generateGeminiStream(prompt: string | string[]) {
  if (!genAI) {
    throw new Error("AI configuration missing");
  }

  let lastError: unknown = null;

  for (const modelName of MODEL_FALLBACKS) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      return await model.generateContentStream(prompt);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Failed to generate Gemini response");
}

// Non-streaming Gemini generation, used for short prompts (e.g. titles).
export async function generateGeminiText(prompt: string | string[]): Promise<string> {
  if (!genAI) throw new Error("AI configuration missing");
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const result = await model.generateContent(Array.isArray(prompt) ? prompt : String(prompt));
  return result.response?.text?.()?.trim?.() ?? "";
}
