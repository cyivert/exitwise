// Simple in-memory sliding-window rate limiter for auth endpoints.
// Returns true when the supplied key has exceeded its quota.

const LIMIT = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

const buckets = new Map<string, { count: number; reset: number }>();

export function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const data = buckets.get(key);

  if (!data || now > data.reset) {
    buckets.set(key, { count: 1, reset: now + WINDOW_MS });
    return false;
  }

  if (data.count >= LIMIT) return true;
  data.count++;
  return false;
}
