// Runtime configuration loaded from environment variables.
// Throws at module load time if a required secret is missing.

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  throw new Error("JWT_SECRET is required");
}

export const PORT = Number(process.env.PORT) || 8080;
export const JWT_SECRET: string = jwtSecret;

export const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
export const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
export const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-3-5-haiku-20241022";
export const ANTHROPIC_BASE_URL =
  process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com/v1/messages";

export const DATABASE_URL = process.env.DATABASE_URL || "";

// Demo API runs when the configured DB host is unreachable from the local
// dev environment (Railway private hosts are not routable outside the project).
export const USE_DEMO_API =
  DATABASE_URL.includes(".railway.internal") && !process.env.RAILWAY_ENVIRONMENT;

// Default Content Security Policy and hardening headers applied to every response.
export const SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' http://localhost:8080 https://exitwise.app; object-src 'none';",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
};
