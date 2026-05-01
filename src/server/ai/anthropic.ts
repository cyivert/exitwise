import { ANTHROPIC_API_KEY, ANTHROPIC_BASE_URL, ANTHROPIC_MODEL } from "../config";

// Models tried in order for streaming requests.
const STREAM_FALLBACKS = [ANTHROPIC_MODEL, "claude-3-5-sonnet-20241022"];

// Yields chunks shaped like the Gemini stream output for transparent
// interchangeability in the route handlers.
// reader is intentionally untyped — fetch's Response.body type and Bun's
// extended reader type do not match exactly, and we only call .read() on it.
async function* parseAnthropicSSE(reader: { read(): Promise<{ done: boolean; value?: Uint8Array }> }) {
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let idx;
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      const raw = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 2);
      const lines = raw.split(/\n/);

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (!data || data === "[DONE]") continue;

        try {
          const obj = JSON.parse(data);
          if (obj.type === "content_block_delta" && obj.delta?.type === "text_delta") {
            yield { text: () => String(obj.delta.text) };
          }
        } catch {
          // Skip unparseable lines silently.
        }
      }
    }
  }
}

// Stream an Anthropic response. Returns an object with a `.stream` async iterable
// matching the Gemini API shape.
export async function generateAnthropicStream(prompt: string | string[]) {
  if (!ANTHROPIC_API_KEY) throw new Error("Anthropic API key missing");

  let lastError: unknown = null;

  for (const modelName of STREAM_FALLBACKS) {
    try {
      const promptText = Array.isArray(prompt) ? prompt.join("\n") : String(prompt);
      const body = {
        model: modelName,
        messages: [{ role: "user", content: promptText }],
        max_tokens: 1024,
        stream: true,
      };

      const res = await fetch(ANTHROPIC_BASE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        let bodyText = "";
        try {
          const json = await res.json();
          bodyText = JSON.stringify(json);
        } catch {
          bodyText = await res.text().catch(() => "");
        }
        console.error("[anthropic] non-ok response", res.status, bodyText);
        throw new Error(`Anthropic error ${res.status}: ${bodyText}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No stream from Anthropic");

      return { stream: parseAnthropicSSE(reader) };
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Anthropic generation failed");
}

// Single-shot Anthropic generation. Used for short utility prompts.
export async function generateAnthropicText(prompt: string | string[]): Promise<string> {
  if (!ANTHROPIC_API_KEY) throw new Error("Anthropic API key missing");

  const promptText = Array.isArray(prompt) ? prompt.join("\n") : String(prompt);
  const body = {
    model: ANTHROPIC_MODEL,
    messages: [{ role: "user", content: promptText }],
    max_tokens: 512,
  };

  const res = await fetch(ANTHROPIC_BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Anthropic error ${res.status}: ${txt}`);
  }

  const json = (await res.json()) as { content?: Array<{ text?: string }> };
  const text = json?.content?.[0]?.text ?? null;
  return typeof text === "string" ? text : JSON.stringify(json);
}
