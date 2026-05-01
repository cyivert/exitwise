// Maps AI provider errors to a normalised error payload understood by route handlers.

export type ParsedAiError = {
  status: number;
  message: string;
  retryAfterSeconds: number | null;
  rawMessage: string;
};

const FALLBACK_MESSAGE = "AI is temporarily unavailable. Please try again shortly.";

export function parseGeminiError(error: unknown): ParsedAiError {
  const rawMessage =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : FALLBACK_MESSAGE;

  const message = rawMessage || FALLBACK_MESSAGE;
  const lower = message.toLowerCase();

  const isQuotaOrRateLimit =
    lower.includes("429") ||
    lower.includes("too many requests") ||
    lower.includes("quota exceeded") ||
    lower.includes("rate limit");

  // Extract a retry hint from common Gemini error message shapes.
  let retryAfterSeconds: number | null = null;
  const retryMatch =
    message.match(/retry(?:\s+in)?\s+([\d.]+)s/i) || message.match(/"retryDelay":"(\d+)s"/i);
  if (retryMatch) {
    const parsed = Number(retryMatch[1]);
    if (Number.isFinite(parsed) && parsed > 0) {
      retryAfterSeconds = Math.ceil(parsed);
    }
  }

  if (isQuotaOrRateLimit) {
    return {
      status: 429,
      message:
        "Gemini rate limit reached for this project. Please retry shortly or add billing/quota for the configured API key.",
      retryAfterSeconds,
      rawMessage: message,
    };
  }

  return {
    status: 500,
    message: FALLBACK_MESSAGE,
    retryAfterSeconds,
    rawMessage: message,
  };
}
