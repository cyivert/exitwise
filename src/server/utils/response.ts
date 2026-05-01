import { SECURITY_HEADERS } from "../config";

// Build a fresh Headers object seeded with the default security headers.
// Cloning is required because Headers instances are mutable.
export function buildSecurityHeaders(): Headers {
  return new Headers(SECURITY_HEADERS);
}

// Build security headers and pre-set Content-Type to JSON.
// Used by every API route that returns JSON.
export function buildJsonHeaders(): Headers {
  const headers = buildSecurityHeaders();
  headers.set("Content-Type", "application/json");
  return headers;
}

// Wrap arbitrary data in a JSON Response with the given headers.
export function safeJson(
  data: unknown,
  headers: Headers,
  init: ResponseInit = {},
): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers,
  });
}

// Standard error responses used across handlers.
export function unauthorized(): Response {
  return new Response("Unauthorized", { status: 401 });
}

export function jsonError(
  message: string,
  status: number,
  headers: Headers,
): Response {
  return safeJson({ message }, headers, { status });
}
