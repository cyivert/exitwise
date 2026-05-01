// Text sanitisation helpers. Used wherever raw user content or model output
// is interpolated into prompts or responses that must be plain text.

// Decode common HTML entities, strip tags, and collapse whitespace.
export function normalizeContextText(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Truncate a string to maxChars, appending an ellipsis when truncated.
export function limitText(text: string, maxChars: number): string {
  if (!text) return "";
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(0, maxChars - 3))}...`;
}

// Coerce an unknown value to a normalized string, returning empty for non-strings.
export function asSafeText(value: unknown): string {
  if (typeof value !== "string") return "";
  return normalizeContextText(value);
}
