import { join } from "path";
import jwt from "jsonwebtoken";
import { GoogleGenerativeAI } from "@google/generative-ai";
import sql from "./src/database/db";
import { z } from "zod";
import { loginSchema, signupSchema } from "./src/schemas/auth";

// Railway/Bun entry point. dynamic port + security.
const port = process.env.PORT || 8080;
const DIST_PATH = join(process.cwd(), "dist");
const JWT_SECRET = process.env.JWT_SECRET;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is required");
}

const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

// simple in-memory rate limit for auth.
const rateLimit = new Map<string, { count: number; reset: number }>();
function checkRateLimit(key: string) {
  const limit = 5;
  const window = 15 * 60 * 1000; // 15 min
  const now = Date.now();
  const data = rateLimit.get(key);
  if (!data || now > data.reset) {
    rateLimit.set(key, { count: 1, reset: now + window });
    return false;
  }
  if (data.count >= limit) return true;
  data.count++;
  return false;
}

function verifyToken(authHeader: string | null) {
  if (!authHeader?.startsWith("Bearer ")) return null;
  try {
    return jwt.verify(authHeader.split(" ")[1], JWT_SECRET) as { sub: string, role: string };
  } catch {
    return null;
  }
}

Bun.serve({
  port: port,
  async fetch(req) {
    const url = new URL(req.url);
    
    // security headers.
    const headers = new Headers({
      "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' http://localhost:8080 https://exitwise.app; object-src 'none';",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    });

    // api routes.
    if (url.pathname.startsWith("/api")) {
      const apiHeaders = new Headers(headers);
      apiHeaders.set("Content-Type", "application/json");

      // auth signup
      if (url.pathname === "/api/auth/signup" && req.method === "POST") {
        const apiHeaders = new Headers(headers);
        apiHeaders.set("Content-Type", "application/json");
        try {
          const body = await req.json();
          const validated = signupSchema.parse(body);
          const { email, password, full_name, role, org_name, invite_code } = validated;

          const ip = req.headers.get("x-forwarded-for") || "unknown";
          if (checkRateLimit(`signup:${ip}`)) {
            return new Response(JSON.stringify({ message: "Too many requests" }), { status: 429, headers: apiHeaders });
          }

          let org_id;

          if (invite_code) {
            const [org] = await sql`SELECT id FROM organizations WHERE invite_code = ${invite_code}`;
            if (!org) {
              return new Response(JSON.stringify({ message: "Invalid invite code" }), { status: 400, headers: apiHeaders });
            }
            org_id = org.id;
          } else if (org_name) {
            // New org creation (hackathon shortcut: first user is admin/retiree)
            const [org] = await sql`
              INSERT INTO organizations (name, industry, invite_code) 
              VALUES (${org_name}, 'other', substring(gen_random_uuid()::text, 1, 8)) 
              RETURNING id
            `;
            org_id = org.id;
          } else {
            return new Response(JSON.stringify({ message: "Organization name or invite code required" }), { status: 400, headers: apiHeaders });
          }

          const password_hash = await Bun.password.hash(password);
          const [user] = await sql`
            INSERT INTO users (org_id, email, password_hash, full_name, role) 
            VALUES (${org_id}, ${email}, ${password_hash}, ${full_name}, ${role}) 
            RETURNING id, org_id, email, full_name, role, created_at
          `;
          const token = jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
          return new Response(JSON.stringify({ user, token }), { headers: apiHeaders });
        } catch (e: any) {
          const message = e instanceof z.ZodError ? e.issues[0].message : e.message;
          return new Response(JSON.stringify({ message }), { status: 400, headers: apiHeaders });
        }
      }

      // auth login
      if (url.pathname === "/api/auth/login" && req.method === "POST") {
        const apiHeaders = new Headers(headers);
        apiHeaders.set("Content-Type", "application/json");
        try {
          const body = await req.json();
          const validated = loginSchema.parse(body);
          const { email, password } = validated;

          const ip = req.headers.get("x-forwarded-for") || "unknown";
          if (checkRateLimit(`login:${ip}:${email}`)) {
            return new Response(JSON.stringify({ message: "Too many attempts" }), { status: 429, headers: apiHeaders });
          }

          const [user] = await sql`SELECT * FROM users WHERE email = ${email}`;
          if (!user || !(await Bun.password.verify(password, user.password_hash))) {
            return new Response(JSON.stringify({ message: "Invalid credentials" }), { status: 401, headers: apiHeaders });
          }
          const { password_hash, ...userSafe } = user;
          const token = jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
          return new Response(JSON.stringify({ user: userSafe, token }), { headers: apiHeaders });
        } catch (e: any) {
          const message = e instanceof z.ZodError ? e.issues[0].message : e.message;
          return new Response(JSON.stringify({ message }), { status: 400, headers: apiHeaders });
        }
      }

      // gemini stream proxy
      if (url.pathname === "/api/interview/stream" && req.method === "POST") {
        const decoded = verifyToken(req.headers.get("Authorization"));
        if (!decoded || decoded.role !== 'retiree') return new Response("Unauthorized", { status: 401 });

        if (!genAI) return new Response("AI configuration missing", { status: 500 });

        try {
          const { sessionId, userResponse } = await req.json();
          
          // fetch context from DB.
          const [session] = await sql`SELECT * FROM interview_sessions WHERE id = ${sessionId}`;
          const [retiree] = await sql`SELECT * FROM users WHERE id = ${decoded.sub}`;

          if (!session) return new Response("Session not found", { status: 404 });

          const prompt = `
            You are ExitWise AI. You interview retiring employees to extract tacit knowledge.
            Retiree: ${retiree.full_name}, ${retiree.job_title || 'Expert'}, ${retiree.years_exp || 20} years exp.
            Session: ${session.session_number} - Focus: ${session.session_focus}.
            
            History Summary: ${JSON.stringify(session.running_summary)}
            
            SIGNALS TO PROBE:
            1. Vague qualifiers ("you just know", "it depends") -> Ask for concrete example.
            2. Skipped steps -> Ask what happens between A and B.
            3. Buried stories ("one time we had") -> STOP. Ask about that incident.
            4. Exception clauses ("except when") -> Probe how to know you are in exception.

            RULES:
            - Max 3 follow-ups per topic.
            - One question at a time.
            - Acknowledge then ask.
            - No HR language. Speak industry language.
            - TAKING YOUR TIME. Capture HOW they think.
          `;

          const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
          const result = await model.generateContentStream([prompt, userResponse]);

          const stream = new ReadableStream({
            async start(controller) {
              for await (const chunk of result.stream) {
                controller.enqueue(chunk.text());
              }
              controller.close();
            },
          });

          return new Response(stream, { headers: { ...headers, "Content-Type": "text/plain; charset=utf-8" } });
        } catch (e: any) {
          return new Response(JSON.stringify({ message: e.message }), { status: 500, headers: apiHeaders });
        }
      }

      return new Response(JSON.stringify({ status: "ok", message: "ExitWise API active" }), {
        headers: apiHeaders
      });
    }

    // /caveman: serve static files from dist.
    let filePath = join(DIST_PATH, url.pathname);
    if (url.pathname === "/") filePath = join(DIST_PATH, "index.html");

    const file = Bun.file(filePath);
    if (await file.exists()) {
      return new Response(file, { headers });
    }

    // /caveman: fallback to index.html for spa routing.
    const index = Bun.file(join(DIST_PATH, "index.html"));
    if (await index.exists()) {
      return new Response(index, { headers });
    }

    return new Response("ExitWise Backend Active (Build missing?)", { status: 404, headers });
  },
});

console.log(`Server running on port ${port}`);
