import { z } from "zod";
import { handleDemoApi } from "../demo/handler";
import { buildJsonHeaders, safeJson } from "../utils/response";
import { login, signup } from "./auth";
import { getDashboard, setReleaseDate } from "./dashboard";
import {
  createExperience,
  deleteExperience,
  generateTitle,
} from "./experiences";
import { saveExchange } from "./exchanges";
import { streamInterview } from "./interview";
import { createMember, deleteMember } from "./org";
import { completeSession, getSession, listSessions } from "./sessions";
import {
  confirmChat,
  getOrCreateChat,
  listRetirees,
  resetChat,
  saveChatMessage,
  streamSuccessorChat,
} from "./successor";

// Centralised API router. Each handler is responsible for its own auth checks.
// Pattern: try the demo backend first, then dispatch by method+pathname.
// Returns 404 JSON for unmatched /api/* requests so the SPA fallback never
// swallows mistyped API paths.
export async function handleApiRequest(req: Request, url: URL): Promise<Response> {
  const headers = buildJsonHeaders();

  // Demo API short-circuits the real handlers when active.
  try {
    const demoResponse = await handleDemoApi(req, url, headers);
    if (demoResponse) return demoResponse;
  } catch (e: any) {
    const message = e instanceof z.ZodError ? e.issues[0].message : e.message;
    return safeJson({ message }, headers, { status: 400 });
  }

  const route = await dispatch(req, url);
  if (route) return route;

  // Unknown /api path — return JSON 404 instead of falling through to SPA.
  return new Response(JSON.stringify({ message: "Route not found" }), {
    status: 404,
    headers: { "Content-Type": "application/json" },
  });
}

// Method+path dispatcher. Returns null when no route matched.
async function dispatch(req: Request, url: URL): Promise<Response | null> {
  const { pathname } = url;
  const method = req.method;

  // --- Auth -----------------------------------------------------------------
  if (pathname === "/api/auth/signup" && method === "POST") return signup(req);
  if (pathname === "/api/auth/login" && method === "POST") return login(req);

  // --- Dashboard ------------------------------------------------------------
  if (pathname === "/api/dashboard" && method === "GET") return getDashboard(req);
  if (pathname === "/api/dashboard/release" && method === "POST") return setReleaseDate(req);

  // --- Org admin ------------------------------------------------------------
  if (pathname === "/api/org/members" && method === "POST") return createMember(req);
  if (pathname.startsWith("/api/org/members/") && method === "DELETE") {
    return deleteMember(req, url);
  }

  // --- Experiences ----------------------------------------------------------
  if (pathname === "/api/experiences" && method === "POST") return createExperience(req);
  if (
    pathname.startsWith("/api/experiences/") &&
    pathname.endsWith("/title") &&
    method === "POST"
  ) {
    return generateTitle(req, url);
  }
  if (pathname.startsWith("/api/experiences/") && method === "DELETE") {
    return deleteExperience(req, url);
  }

  // --- Sessions -------------------------------------------------------------
  if (pathname === "/api/sessions" && method === "GET") return listSessions(req, url);
  if (
    /^\/api\/interview\/session\/[^/]+\/complete$/.test(pathname) &&
    method === "POST"
  ) {
    return completeSession(req, url);
  }
  if (pathname.startsWith("/api/sessions/") && method === "GET") {
    return getSession(req, url);
  }

  // --- Exchanges ------------------------------------------------------------
  if (pathname === "/api/exchanges" && method === "POST") return saveExchange(req);

  // --- Interview stream -----------------------------------------------------
  if (pathname === "/api/interview/stream" && method === "POST") return streamInterview(req);

  // --- Successor flows ------------------------------------------------------
  if (pathname === "/api/successor/retirees" && method === "GET") return listRetirees(req);

  // Specific successor chat routes must be matched before the generic
  // "/api/successor/chat/:engagementId" GET handler.
  if (
    pathname.startsWith("/api/successor/chat/") &&
    pathname.endsWith("/reset") &&
    method === "POST"
  ) {
    return resetChat(req, url);
  }
  if (pathname === "/api/successor/chat/messages" && method === "POST") {
    return saveChatMessage(req);
  }
  if (
    pathname.startsWith("/api/successor/chat/") &&
    pathname.endsWith("/confirm") &&
    method === "POST"
  ) {
    return confirmChat(req, url);
  }
  if (pathname.startsWith("/api/successor/chat/") && method === "GET") {
    return getOrCreateChat(req, url);
  }
  if (pathname === "/api/successor/stream" && method === "POST") {
    return streamSuccessorChat(req);
  }

  // Health/default response for /api root.
  if (pathname === "/api" || pathname === "/api/") {
    return new Response(
      JSON.stringify({ status: "ok", message: "ExitWise API active" }),
      { headers: buildJsonHeaders() },
    );
  }

  return null;
}
