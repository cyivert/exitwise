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

function normalizeContextText(text: string) {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const SESSION_FOCUS_SEQUENCE = ['orientation', 'processes', 'decisions', 'relationships', 'edge_cases', 'review'] as const;

async function createExperienceSessions(engagementId: string, orgId: string, retireeId: string) {
  const sessions = [];

  for (let index = 0; index < SESSION_FOCUS_SEQUENCE.length; index++) {
    const [session] = await sql`
      INSERT INTO interview_sessions (engagement_id, org_id, retiree_id, session_number, session_focus, status)
      VALUES (${engagementId}, ${orgId}, ${retireeId}, ${index + 1}, ${SESSION_FOCUS_SEQUENCE[index]}, 'pending')
      RETURNING *
    `;
    sessions.push(session);
  }

  return sessions;
}

async function createExperienceForRetiree(retiree: { id: string; org_id: string }) {
  const [engagement] = await sql`
    INSERT INTO transfer_engagements (org_id, retiree_id, status)
    VALUES (${retiree.org_id}, ${retiree.id}, 'active')
    RETURNING *
  `;

  const sessions = await createExperienceSessions(engagement.id, retiree.org_id, retiree.id);
  return { engagement, sessions };
}

async function getOrganizationAdminContext(userId: string) {
  const [adminUser] = await sql`SELECT id, org_id FROM users WHERE id = ${userId}` as Array<{ id: string; org_id: string }>;
  if (!adminUser) return null;

  const [organization] = await sql`SELECT * FROM organizations WHERE id = ${adminUser.org_id}`;
  const members = await sql`
    SELECT id, org_id, email, full_name, role, job_title, years_exp, created_at
    FROM users
    WHERE org_id = ${adminUser.org_id}
    ORDER BY created_at DESC
  `;

  const experiences = await sql`
    SELECT e.*, u.full_name AS retiree_name, u.email AS retiree_email, u.job_title AS retiree_job_title
    FROM transfer_engagements e
    JOIN users u ON u.id = e.retiree_id
    WHERE e.org_id = ${adminUser.org_id}
    ORDER BY e.created_at DESC
  `;

  return { organization, members, experiences };
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
          let { email, password, full_name, role, org_name, invite_code } = validated;

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
            // New org creation: first user becomes the organization admin.
            const [org] = await sql`
              INSERT INTO organizations (name, industry, invite_code) 
              VALUES (${org_name}, 'other', substring(gen_random_uuid()::text, 1, 8)) 
              RETURNING id
            `;
            org_id = org.id;
            role = 'organization_admin';
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

          // hackathon auto-setup: ensure retiree has an engagement and 6 sessions.
          if (user.role === 'retiree') {
            const [engagement] = await sql`SELECT id FROM transfer_engagements WHERE retiree_id = ${user.id}`;
            if (!engagement) {
              await createExperienceForRetiree({ id: user.id, org_id: user.org_id });
            }
          }

          const { password_hash, ...userSafe } = user;
          const token = jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
          return new Response(JSON.stringify({ user: userSafe, token }), { headers: apiHeaders });
        } catch (e: any) {
          const message = e instanceof z.ZodError ? e.issues[0].message : e.message;
          return new Response(JSON.stringify({ message }), { status: 400, headers: apiHeaders });
        }
      }

      // dashboard fetch
      if (url.pathname === "/api/dashboard" && req.method === "GET") {
        const decoded = verifyToken(req.headers.get("Authorization"));
        if (!decoded) return new Response("Unauthorized", { status: 401 });

        const apiHeaders = new Headers(headers);
        apiHeaders.set("Content-Type", "application/json");

        try {
          if (decoded.role === 'retiree') {
            const [retiree] = await sql`SELECT id, org_id FROM users WHERE id = ${decoded.sub}`;
            if (!retiree) return new Response(JSON.stringify({ experiences: [], activeExperience: null, sessions: [] }), { headers: apiHeaders });

            const experiences = await sql`
              SELECT *
              FROM transfer_engagements
              WHERE retiree_id = ${decoded.sub}
              ORDER BY created_at DESC
            `;

            const activeExperience = experiences.find((experience) => experience.status === 'active') || experiences[0] || null;
            const sessions = activeExperience
              ? await sql`
                  SELECT *
                  FROM interview_sessions
                  WHERE engagement_id = ${activeExperience.id}
                  ORDER BY session_number ASC
                `
              : [];

            return new Response(JSON.stringify({ experiences, activeExperience, sessions }), { headers: apiHeaders });
          }

          if (decoded.role === 'organization_admin' || decoded.role === 'admin') {
            const adminContext = await getOrganizationAdminContext(decoded.sub);
            if (!adminContext) return new Response(JSON.stringify({ organization: null, members: [], experiences: [] }), { headers: apiHeaders });

            return new Response(JSON.stringify(adminContext), { headers: apiHeaders });
          }
          
          if (decoded.role === 'successor') {
            const [engagement] = await sql`SELECT * FROM transfer_engagements WHERE successor_id = ${decoded.sub} OR org_id IN (SELECT org_id FROM users WHERE id = ${decoded.sub})`;
            if (!engagement) return new Response(JSON.stringify({ engagement: null }), { headers: apiHeaders });
            return new Response(JSON.stringify({ engagement }), { headers: apiHeaders });
          }

          return new Response(JSON.stringify({ status: "ok" }), { headers: apiHeaders });
        } catch (e: any) {
          return new Response(JSON.stringify({ message: e.message }), { status: 500, headers: apiHeaders });
        }
      }

      if (url.pathname === "/api/org/members" && req.method === "POST") {
        const decoded = verifyToken(req.headers.get("Authorization"));
        if (!decoded || (decoded.role !== 'organization_admin' && decoded.role !== 'admin')) return new Response("Unauthorized", { status: 401 });

        const apiHeaders = new Headers(headers);
        apiHeaders.set("Content-Type", "application/json");

        try {
          const body = await req.json();
          const { full_name, email, password, role, job_title, years_exp } = body;
          const [adminUser] = await sql`SELECT id, org_id FROM users WHERE id = ${decoded.sub}` as Array<{ id: string; org_id: string }>;
          if (!adminUser) return new Response(JSON.stringify({ message: "Organization admin not found" }), { status: 404, headers: apiHeaders });

          const password_hash = await Bun.password.hash(password);
          const [user] = await sql`
            INSERT INTO users (org_id, email, password_hash, full_name, role, job_title, years_exp)
            VALUES (${adminUser.org_id}, ${email}, ${password_hash}, ${full_name}, ${role}, ${job_title ?? null}, ${years_exp ?? null})
            RETURNING id, org_id, email, full_name, role, job_title, years_exp, created_at
          `;

          return new Response(JSON.stringify({ user }), { headers: apiHeaders });
        } catch (e: any) {
          return new Response(JSON.stringify({ message: e.message }), { status: 500, headers: apiHeaders });
        }
      }

      if (url.pathname.startsWith("/api/org/members/") && req.method === "DELETE") {
        const decoded = verifyToken(req.headers.get("Authorization"));
        if (!decoded || (decoded.role !== 'organization_admin' && decoded.role !== 'admin')) return new Response("Unauthorized", { status: 401 });

        const apiHeaders = new Headers(headers);
        apiHeaders.set("Content-Type", "application/json");

        try {
          const memberId = url.pathname.split("/").pop();
          if (!memberId || memberId === decoded.sub) {
            return new Response(JSON.stringify({ message: "Member not found" }), { status: 404, headers: apiHeaders });
          }

          const [adminUser] = await sql`SELECT id, org_id FROM users WHERE id = ${decoded.sub}` as Array<{ id: string; org_id: string }>;
          if (!adminUser) return new Response(JSON.stringify({ message: "Organization admin not found" }), { status: 404, headers: apiHeaders });

          const [member] = await sql`
            SELECT * FROM users
            WHERE id = ${memberId} AND org_id = ${adminUser.org_id}
          `;

          if (!member) {
            return new Response(JSON.stringify({ message: "Member not found" }), { status: 404, headers: apiHeaders });
          }

          if (member.role === 'organization_admin' || member.role === 'admin') {
            return new Response(JSON.stringify({ message: "Organization admins cannot be deleted from the dashboard" }), { status: 400, headers: apiHeaders });
          }

          if (member.role === 'retiree') {
            await sql`DELETE FROM transfer_engagements WHERE retiree_id = ${memberId}`;
          }

          if (member.role === 'successor') {
            await sql`UPDATE transfer_engagements SET successor_id = NULL WHERE successor_id = ${memberId}`;
          }

          await sql`DELETE FROM users WHERE id = ${memberId}`;
          return new Response(JSON.stringify({ status: "success" }), { headers: apiHeaders });
        } catch (e: any) {
          return new Response(JSON.stringify({ message: e.message }), { status: 500, headers: apiHeaders });
        }
      }

      if (url.pathname === "/api/experiences" && req.method === "POST") {
        const decoded = verifyToken(req.headers.get("Authorization"));
        if (!decoded || decoded.role !== 'retiree') return new Response("Unauthorized", { status: 401 });

        const apiHeaders = new Headers(headers);
        apiHeaders.set("Content-Type", "application/json");

        try {
          const [retiree] = await sql`SELECT id, org_id FROM users WHERE id = ${decoded.sub}` as Array<{ id: string; org_id: string }>;
          if (!retiree) return new Response(JSON.stringify({ message: "Retiree not found" }), { status: 404, headers: apiHeaders });

          const result = await createExperienceForRetiree(retiree);
          return new Response(JSON.stringify(result), { headers: apiHeaders });
        } catch (e: any) {
          return new Response(JSON.stringify({ message: e.message }), { status: 500, headers: apiHeaders });
        }
      }

      if (url.pathname.startsWith("/api/experiences/") && req.method === "DELETE") {
        const decoded = verifyToken(req.headers.get("Authorization"));
        if (!decoded || decoded.role !== 'retiree') return new Response("Unauthorized", { status: 401 });

        const apiHeaders = new Headers(headers);
        apiHeaders.set("Content-Type", "application/json");

        try {
          const engagementId = url.pathname.split("/").pop();
          if (!engagementId) {
            return new Response(JSON.stringify({ message: "Experience not found" }), { status: 404, headers: apiHeaders });
          }

          const [experience] = await sql`
            SELECT *
            FROM transfer_engagements
            WHERE id = ${engagementId} AND retiree_id = ${decoded.sub}
          `;

          if (!experience) {
            return new Response(JSON.stringify({ message: "Experience not found" }), { status: 404, headers: apiHeaders });
          }

          await sql`DELETE FROM transfer_engagements WHERE id = ${engagementId}`;
          return new Response(JSON.stringify({ status: "success" }), { headers: apiHeaders });
        } catch (e: any) {
          return new Response(JSON.stringify({ message: e.message }), { status: 500, headers: apiHeaders });
        }
      }

      // session list
      if (url.pathname === "/api/sessions" && req.method === "GET") {
        const decoded = verifyToken(req.headers.get("Authorization"));
        if (!decoded) return new Response("Unauthorized", { status: 401 });

        const apiHeaders = new Headers(headers);
        apiHeaders.set("Content-Type", "application/json");

        try {
          const engagementId = url.searchParams.get("engagement_id");
          if (!engagementId) {
            return new Response(JSON.stringify([]), { headers: apiHeaders });
          }

          const sessions = await sql`
            SELECT * FROM interview_sessions
            WHERE engagement_id = ${engagementId}
            ORDER BY session_number ASC
          `;

          return new Response(JSON.stringify(sessions), { headers: apiHeaders });
        } catch (e: any) {
          return new Response(JSON.stringify({ message: e.message }), { status: 500, headers: apiHeaders });
        }
      }

      // set release date
      if (url.pathname === "/api/dashboard/release" && req.method === "POST") {
        const decoded = verifyToken(req.headers.get("Authorization"));
        if (!decoded || decoded.role !== 'retiree') return new Response("Unauthorized", { status: 401 });

        const apiHeaders = new Headers(headers);
        apiHeaders.set("Content-Type", "application/json");

        try {
          const { release_date, engagement_id } = await req.json();
          if (engagement_id) {
            await sql`UPDATE transfer_engagements SET release_date = ${release_date} WHERE id = ${engagement_id} AND retiree_id = ${decoded.sub}`;
          } else {
            await sql`UPDATE transfer_engagements SET release_date = ${release_date} WHERE retiree_id = ${decoded.sub}`;
          }
          return new Response(JSON.stringify({ status: "success" }), { headers: apiHeaders });
        } catch (e: any) {
          return new Response(JSON.stringify({ message: e.message }), { status: 500, headers: apiHeaders });
        }
      }

      // session detail
      if (url.pathname.startsWith("/api/sessions/") && req.method === "GET") {
        const decoded = verifyToken(req.headers.get("Authorization"));
        if (!decoded) return new Response("Unauthorized", { status: 401 });
        
        const sessionId = url.pathname.split("/").pop();
        const apiHeaders = new Headers(headers);
        apiHeaders.set("Content-Type", "application/json");

        if (!sessionId) {
          return new Response(JSON.stringify({ message: "Session not found" }), { status: 404, headers: apiHeaders });
        }

        try {
          const [session] = await sql`SELECT * FROM interview_sessions WHERE id = ${sessionId}`;
          if (!session) return new Response(JSON.stringify({ message: "Session not found" }), { status: 404, headers: apiHeaders });

          const [latestExchange] = await sql`
            SELECT * FROM interview_exchanges
            WHERE session_id = ${sessionId}
            ORDER BY created_at DESC
            LIMIT 1
          `;

          return new Response(JSON.stringify({
            ...session,
            latest_exchange: latestExchange ?? null,
          }), { headers: apiHeaders });
        } catch (e: any) {
          return new Response(JSON.stringify({ message: e.message }), { status: 500, headers: apiHeaders });
        }
      }

      // save exchange
      if (url.pathname === "/api/exchanges" && req.method === "POST") {
        const decoded = verifyToken(req.headers.get("Authorization"));
        if (!decoded) return new Response("Unauthorized", { status: 401 });

        const apiHeaders = new Headers(headers);
        apiHeaders.set("Content-Type", "application/json");

        try {
          const { id, session_id, question_text, question_type, response_text, ai_follow_up, sequence_order } = await req.json();
          const [session] = await sql`
            SELECT s.id, s.running_summary, e.org_id, e.retiree_id
            FROM interview_sessions s
            JOIN transfer_engagements e ON e.id = s.engagement_id
            WHERE s.id = ${session_id}
          `;

          if (!session) {
            return new Response(JSON.stringify({ message: "Session not found" }), { status: 404, headers: apiHeaders });
          }

          const shouldAppendSummary = Boolean(response_text) && !ai_follow_up;
          const summaryEntry = shouldAppendSummary
            ? {
                question_text,
                response_text,
                sequence_order: sequence_order ?? 0,
                created_at: new Date().toISOString(),
              }
            : null;

          await sql`
            INSERT INTO interview_exchanges (id, session_id, org_id, retiree_id, question_text, question_type, response_text, ai_follow_up, sequence_order)
            VALUES (${id}, ${session_id}, ${session.org_id}, ${session.retiree_id}, ${question_text}, ${question_type}, ${response_text}, ${ai_follow_up ?? null}, ${sequence_order ?? 0})
            ON CONFLICT (id) DO UPDATE SET
              session_id = EXCLUDED.session_id,
              org_id = EXCLUDED.org_id,
              retiree_id = EXCLUDED.retiree_id,
              question_text = EXCLUDED.question_text,
              question_type = EXCLUDED.question_type,
              response_text = EXCLUDED.response_text,
              ai_follow_up = COALESCE(EXCLUDED.ai_follow_up, interview_exchanges.ai_follow_up),
              sequence_order = EXCLUDED.sequence_order
          `;
          if (summaryEntry) {
            await sql`
              UPDATE interview_sessions
              SET running_summary = COALESCE(running_summary, '[]'::jsonb) || ${JSON.stringify([summaryEntry])}::jsonb,
                  status = 'active'
              WHERE id = ${session_id}
            `;
          } else {
            await sql`UPDATE interview_sessions SET status = 'active' WHERE id = ${session_id}`;
          }
          
          return new Response(JSON.stringify({ status: "success" }), { headers: apiHeaders });
        } catch (e: any) {
          return new Response(JSON.stringify({ message: e.message }), { status: 500, headers: apiHeaders });
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
          const [session] = await sql`
            SELECT s.*, e.org_id, e.retiree_id, u.full_name AS retiree_name, u.job_title, u.years_exp, o.name AS org_name
            FROM interview_sessions s
            JOIN transfer_engagements e ON e.id = s.engagement_id
            JOIN users u ON u.id = e.retiree_id
            JOIN organizations o ON o.id = e.org_id
            WHERE s.id = ${sessionId}
          `;

          const recentExchanges = await sql`
            SELECT question_text, response_text, ai_follow_up, sequence_order, created_at
            FROM interview_exchanges
            WHERE session_id = ${sessionId}
            ORDER BY created_at ASC
            LIMIT 6
          `;

          if (!session) return new Response("Session not found", { status: 404 });

          const exchangeContext = recentExchanges
            .map((exchange, index) => {
              const response = exchange.response_text ? normalizeContextText(exchange.response_text) : 'No response saved yet.';
              const followUp = exchange.ai_follow_up ? normalizeContextText(exchange.ai_follow_up) : 'No follow-up saved yet.';
              return `${index + 1}. Q: ${normalizeContextText(exchange.question_text)}\n   A: ${response}\n   Follow-up: ${followUp}`;
            })
            .join('\n');

          const prompt = `
            You are ExitWise AI. You interview retiring employees to extract tacit knowledge.
            Retiree: ${session.retiree_name}, ${session.job_title || 'Expert'}, ${session.years_exp || 20} years exp.
            Organization: ${session.org_name}.
            Session: ${session.session_number} - Focus: ${session.session_focus}.
            Preserve the concrete knowledge the retiree is trying to hand off to the next hires.
            
            History Summary: ${JSON.stringify(session.running_summary)}
            Recent Exchanges:\n${exchangeContext || 'No exchanges saved yet.'}
            
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
            - Output plain text only. Do not use HTML, XML, or markdown formatting.
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

    // /api 404 handler - don't fall through to SPA index.html
    if (url.pathname.startsWith("/api")) {
      return new Response(JSON.stringify({ message: "Route not found" }), { 
        status: 404, 
        headers: { "Content-Type": "application/json" } 
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
