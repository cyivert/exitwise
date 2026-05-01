import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config";
import type { AuthPayload } from "../types";

// Verify a Bearer token from the Authorization header.
// Returns the decoded payload, or null when the header is missing/invalid.
export function verifyToken(authHeader: string | null): AuthPayload | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  try {
    return jwt.verify(authHeader.split(" ")[1], JWT_SECRET) as unknown as AuthPayload;
  } catch {
    return null;
  }
}

// Sign a JWT with the standard 7 day expiry.
export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}
