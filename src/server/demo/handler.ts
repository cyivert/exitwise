import { loginSchema, signupSchema } from "../../schemas/auth";
import { USE_DEMO_API } from "../config";
import type { DemoUser, ExchangePayload } from "../types";
import { signToken, verifyToken } from "../utils/auth";
import { safeJson } from "../utils/response";
import {
  demoExchanges,
  demoExperiences,
  demoOrg,
  demoSessions,
  demoUsers,
  makeDemoExperience,
  toSafeUser,
} from "./store";

// Demo API request handler. Returns null when the request does not match a
// demo route, in which case the main router takes over.
//
// All demo endpoints mirror the shape of the production endpoints so that
// the client code does not need to know which mode the server is in.
export async function handleDemoApi(
  req: Request,
  url: URL,
  headers: Headers,
): Promise<Response | null> {
  if (!USE_DEMO_API) return null;

  const decoded = verifyToken(req.headers.get("Authorization"));

  // Public auth routes — no token required.
  if (url.pathname === "/api/auth/signup" && req.method === "POST") {
    const validated = signupSchema.parse(await req.json());
    const existing = demoUsers.get(validated.email.toLowerCase());
    if (existing) return safeJson({ message: "Email already exists" }, headers, { status: 400 });

    const now = new Date().toISOString();
    const user: DemoUser = {
      id: crypto.randomUUID(),
      org_id: demoOrg.id,
      email: validated.email.toLowerCase(),
      password_hash: await Bun.password.hash(validated.password),
      full_name: validated.full_name,
      role:
        validated.org_name && !validated.invite_code ? "organization_admin" : validated.role,
      created_at: now,
    };
    demoUsers.set(user.email, user);
    if (user.role === "retiree") makeDemoExperience(user);

    const token = signToken({ sub: user.id, role: user.role });
    return safeJson({ user: toSafeUser(user), token }, headers);
  }

  if (url.pathname === "/api/auth/login" && req.method === "POST") {
    const validated = loginSchema.parse(await req.json());
    const user = demoUsers.get(validated.email.toLowerCase());
    if (!user || !(await Bun.password.verify(validated.password, user.password_hash))) {
      return safeJson({ message: "Invalid credentials" }, headers, { status: 401 });
    }
    if (user.role === "retiree") makeDemoExperience(user);

    const token = signToken({ sub: user.id, role: user.role });
    return safeJson({ user: toSafeUser(user), token }, headers);
  }

  // All remaining routes require auth.
  if (!decoded) return null;

  const user = [...demoUsers.values()].find((candidate) => candidate.id === decoded.sub);
  if (!user) {
    return safeJson(
      { message: "Demo user not found. Sign up again after server restart." },
      headers,
      { status: 401 },
    );
  }

  if (url.pathname === "/api/dashboard" && req.method === "GET") {
    if (user.role === "retiree") {
      const experiences = [...demoExperiences.values()].filter(
        (experience) => experience.retiree_id === user.id,
      );
      const activeExperience =
        experiences.find((experience) => experience.status === "active") ||
        experiences[0] ||
        null;
      const sessions = activeExperience
        ? [...demoSessions.values()]
            .filter((session) => session.engagement_id === activeExperience.id)
            .sort((a, b) => a.session_number - b.session_number)
        : [];
      return safeJson({ experiences, activeExperience, sessions }, headers);
    }

    return safeJson(
      {
        organization: demoOrg,
        members: [...demoUsers.values()].map(toSafeUser),
        experiences: [...demoExperiences.values()],
      },
      headers,
    );
  }

  if (url.pathname === "/api/experiences" && req.method === "POST") {
    const engagement = makeDemoExperience(user);
    const sessions = [...demoSessions.values()].filter(
      (session) => session.engagement_id === engagement.id,
    );
    return safeJson({ engagement, sessions }, headers);
  }

  if (url.pathname === "/api/sessions" && req.method === "GET") {
    const engagementId = url.searchParams.get("engagement_id");
    const sessions = [...demoSessions.values()]
      .filter((session) => !engagementId || session.engagement_id === engagementId)
      .sort((a, b) => a.session_number - b.session_number);
    return safeJson(sessions, headers);
  }

  if (url.pathname.startsWith("/api/sessions/") && req.method === "GET") {
    const sessionId = url.pathname.split("/").pop() || "";
    const session = demoSessions.get(sessionId);
    if (!session) return safeJson({ message: "Session not found" }, headers, { status: 404 });
    const session_exchanges = demoExchanges.get(sessionId) || [];
    return safeJson(
      {
        ...session,
        experience_transcript: session_exchanges,
        latest_exchange: session_exchanges.at(-1) || null,
        session_exchanges,
        experience_exchanges: session_exchanges,
      },
      headers,
    );
  }

  if (url.pathname === "/api/exchanges" && req.method === "POST") {
    const body = (await req.json()) as ExchangePayload;
    const current = demoExchanges.get(body.session_id) || [];
    const exchange = { ...body, created_at: new Date().toISOString() };
    demoExchanges.set(body.session_id, [
      ...current.filter((item) => item.id !== body.id),
      exchange,
    ]);
    return safeJson({ status: "success" }, headers);
  }

  if (url.pathname === "/api/interview/stream" && req.method === "POST") {
    return new Response(
      "Thanks. What concrete example best shows that knowledge in action?",
      {
        headers: { ...headers, "Content-Type": "text/plain; charset=utf-8" },
      },
    );
  }

  if (url.pathname.startsWith("/api/profiles/")) {
    return safeJson(
      {
        summary:
          "Local demo profile. Connect a public Postgres DATABASE_URL for persisted data.",
        entries: [...demoExchanges.values()].flat(),
      },
      headers,
    );
  }

  return null;
}
