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
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_BASE_URL = process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com/v1/responses';

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

function limitText(text: string, maxChars: number) {
  if (!text) return '';
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(0, maxChars - 3))}...`;
}

function asSafeText(value: unknown) {
  if (typeof value !== 'string') return '';
  return normalizeContextText(value);
}

async function generateGeminiStream(prompt: string | string[]) {
  if (!genAI) {
    throw new Error('AI configuration missing');
  }

  const models = ["gemini-2.0-flash", "gemini-1.5-flash"];
  let lastError: unknown = null;

  for (const modelName of models) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      return await model.generateContentStream(prompt);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Failed to generate Gemini response');
}

async function generateAnthropicStream(prompt: string | string[]) {
  if (!ANTHROPIC_API_KEY) throw new Error('Anthropic API key missing');

  const models = [process.env.ANTHROPIC_MODEL || 'claude-2.1', 'claude-2.0'];
  let lastError: unknown = null;

  for (const modelName of models) {
    try {
      const body = {
        model: modelName,
        input: Array.isArray(prompt) ? prompt.join('\n') : String(prompt),
        max_tokens: 1024,
        temperature: 0.2,
        stream: true,
      };

      const res = await fetch(ANTHROPIC_BASE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream, application/json',
          'X-API-Key': ANTHROPIC_API_KEY,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`Anthropic error ${res.status}: ${txt}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No stream from Anthropic');

      async function* streamGenerator() {
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          yield { text: () => chunk };
        }
      }

      return { stream: streamGenerator() };
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Anthropic generation failed');
}

async function generateModelStream(prompt: string | string[]) {
  // Priority: Anthropic (if configured) -> Gemini (if configured)
  if (ANTHROPIC_API_KEY) return await generateAnthropicStream(prompt);
  if (GEMINI_API_KEY && genAI) return await generateGeminiStream(prompt);
  throw new Error('No AI provider configured');
}

function parseGeminiError(error: unknown) {
  const fallbackMessage = 'AI is temporarily unavailable. Please try again shortly.';
  const rawMessage = error instanceof Error
    ? error.message
    : typeof error === 'string'
      ? error
      : fallbackMessage;

  const message = rawMessage || fallbackMessage;
  const lower = message.toLowerCase();
  const isQuotaOrRateLimit =
    lower.includes('429') ||
    lower.includes('too many requests') ||
    lower.includes('quota exceeded') ||
    lower.includes('rate limit');

  let retryAfterSeconds: number | null = null;
  const retryMatch = message.match(/retry(?:\s+in)?\s+([\d.]+)s/i) || message.match(/"retryDelay":"(\d+)s"/i);
  if (retryMatch) {
    const parsed = Number(retryMatch[1]);
    if (Number.isFinite(parsed) && parsed > 0) {
      retryAfterSeconds = Math.ceil(parsed);
    }
  }

  if (isQuotaOrRateLimit) {
    return {
      status: 429,
      message: 'Gemini rate limit reached for this project. Please retry shortly or add billing/quota for the configured API key.',
      retryAfterSeconds,
      rawMessage: message,
    };
  }

  return {
    status: 500,
    message: fallbackMessage,
    retryAfterSeconds,
    rawMessage: message,
  };
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

function buildFallbackExperienceTitle(experience: { retiree_name?: string; job_title?: string | null; org_name?: string }, exchanges: Array<{ question_text: string; response_text?: string | null; ai_follow_up?: string | null }>) {
  const sourceText = [...exchanges]
    .reverse()
    .map((exchange) => normalizeContextText(exchange.response_text || exchange.ai_follow_up || exchange.question_text))
    .find((text) => text.length >= 24) || '';

  const compactTitle = sourceText
    .replace(/["'`]/g, '')
    .replace(/[!?】【。:,;()[\]{}]/g, '')
    .split(/\s+/)
    .slice(0, 5)
    .join(' ')
    .trim();

  if (compactTitle) {
    return compactTitle.charAt(0).toUpperCase() + compactTitle.slice(1);
  }

  return `${experience.job_title || 'Retiree'} Knowledge Transfer`;
}

async function generateExperienceTitle(engagementId: string, retireeId: string) {
  const [experience] = await sql`
    SELECT e.id, e.title, e.status, u.full_name AS retiree_name, u.job_title, o.name AS org_name
    FROM transfer_engagements e
    JOIN users u ON u.id = e.retiree_id
    JOIN organizations o ON o.id = e.org_id
    WHERE e.id = ${engagementId} AND e.retiree_id = ${retireeId}
  `;

  if (!experience) {
    throw new Error('Experience not found');
  }

  const exchanges = await sql`
    SELECT s.session_number, s.session_focus, x.question_text, x.response_text, x.ai_follow_up, x.created_at
    FROM interview_sessions s
    JOIN interview_exchanges x ON x.session_id = s.id
    WHERE s.engagement_id = ${engagementId}
    ORDER BY s.session_number ASC, x.created_at ASC
    LIMIT 18
  `;

  const exchangeContext = exchanges.map((exchange, index) => {
    const response = exchange.response_text ? normalizeContextText(exchange.response_text) : 'No response saved.';
    const followUp = exchange.ai_follow_up ? normalizeContextText(exchange.ai_follow_up) : 'No follow-up saved.';
    return `${index + 1}. Session ${exchange.session_number} (${exchange.session_focus})\nQ: ${normalizeContextText(exchange.question_text)}\nA: ${response}\nFollow-up: ${followUp}`;
  }).join('\n\n');

  const prompt = `
    You are naming a retiree knowledge-transfer experience for ExitWise.
    Create a concise, human-readable title under 7 words.
    The title should reflect the substance of the retiree's knowledge, not the organization name.
    Return only the title text. Do not use quotes, bullets, labels, or punctuation at the end.

    Retiree: ${experience.retiree_name}
    Role: ${experience.job_title || 'Expert Retiree'}
    Organization: ${experience.org_name}
    Current Title: ${experience.title || 'Untitled experience'}

    Session Evidence:
    ${exchangeContext || 'No exchanges available yet.'}
  `;

  let cleanedTitle = '';

  try {
    if (genAI) {
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
      const result = await model.generateContent(prompt);
      const generatedText = result.response.text().trim();
      cleanedTitle = normalizeContextText(generatedText)
        .replace(/^title:\s*/i, '')
        .replace(/^['\"`]|['\"`]$/g, '')
        .replace(/[.]+$/g, '')
        .trim();
    }
  } catch {
    cleanedTitle = '';
  }

  if (!cleanedTitle) {
    cleanedTitle = buildFallbackExperienceTitle(experience, exchanges);
  }

  const [updatedExperience] = await sql`
    UPDATE transfer_engagements
    SET title = ${cleanedTitle}, updated_at = NOW()
    WHERE id = ${engagementId} AND retiree_id = ${retireeId}
    RETURNING *
  `;

  return updatedExperience;
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
          const aiError = parseGeminiError(e);
          const responseHeaders = new Headers(apiHeaders);
          if (aiError.retryAfterSeconds) {
            responseHeaders.set('Retry-After', String(aiError.retryAfterSeconds));
          }
          return new Response(JSON.stringify({ message: aiError.message, detail: aiError.rawMessage }), { status: aiError.status, headers: responseHeaders });
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

      if (url.pathname.startsWith("/api/experiences/") && url.pathname.endsWith("/title") && req.method === "POST") {
        const decoded = verifyToken(req.headers.get("Authorization"));
        if (!decoded || decoded.role !== 'retiree') return new Response("Unauthorized", { status: 401 });

        const apiHeaders = new Headers(headers);
        apiHeaders.set("Content-Type", "application/json");

        try {
          const engagementId = url.pathname.split("/")[3];
          if (!engagementId) {
            return new Response(JSON.stringify({ message: "Experience not found" }), { status: 404, headers: apiHeaders });
          }

          const updatedExperience = await generateExperienceTitle(engagementId, decoded.sub);
          return new Response(JSON.stringify({ experience: updatedExperience }), { headers: apiHeaders });
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

          const [experience] = await sql`
            SELECT transcript
            FROM transfer_engagements
            WHERE id = ${session.engagement_id}
          `;

          const experienceExchanges = await sql`
            SELECT x.*, s.session_number, s.session_focus
            FROM interview_exchanges x
            JOIN interview_sessions s ON s.id = x.session_id
            WHERE s.engagement_id = ${session.engagement_id}
            ORDER BY s.session_number ASC, x.created_at ASC
          `;

          const sessionExchanges = experienceExchanges.filter((exchange) => exchange.session_id === sessionId);

          const [latestExchange] = await sql`
            SELECT * FROM interview_exchanges
            WHERE session_id = ${sessionId}
            ORDER BY created_at DESC
            LIMIT 1
          `;

          return new Response(JSON.stringify({
            ...session,
            experience_transcript: experience?.transcript ?? [],
            latest_exchange: latestExchange ?? null,
            session_exchanges: sessionExchanges,
            experience_exchanges: experienceExchanges,
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
            SELECT s.id, s.session_number, s.session_focus, s.running_summary, e.id AS engagement_id, e.org_id, e.retiree_id, e.transcript
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

          const transcriptEntry = {
            id,
            session_id,
            session_number: session.session_number,
            session_focus: session.session_focus,
            org_id: session.org_id,
            retiree_id: session.retiree_id,
            question_text,
            question_type,
            response_text: response_text ?? null,
            ai_follow_up: ai_follow_up ?? null,
            sequence_order: sequence_order ?? 0,
            created_at: new Date().toISOString(),
          };

          const currentTranscript = Array.isArray(session.transcript) ? session.transcript : [];
          const nextTranscript = [...currentTranscript];
          const existingTranscriptIndex = nextTranscript.findIndex((entry) => entry.id === id);

          if (existingTranscriptIndex >= 0) {
            nextTranscript[existingTranscriptIndex] = {
              ...nextTranscript[existingTranscriptIndex],
              ...transcriptEntry,
            };
          } else {
            nextTranscript.push(transcriptEntry);
          }

          await sql`
            UPDATE transfer_engagements
            SET transcript = ${JSON.stringify(nextTranscript)}::jsonb,
                updated_at = NOW()
            WHERE id = ${session.engagement_id}
          `;
          
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

          const result = await generateModelStream([prompt, userResponse]);

          const stream = new ReadableStream({
            async start(controller) {
              for await (const chunk of result.stream) {
                const text = typeof chunk?.text === 'function' ? chunk.text() : '';
                if (text) {
                  controller.enqueue(text);
                }
              }
              controller.close();
            },
          });

          return new Response(stream, { headers: { ...headers, "Content-Type": "text/plain; charset=utf-8" } });
        } catch (e: any) {
          return new Response(JSON.stringify({ message: e.message }), { status: 500, headers: apiHeaders });
        }
      }

      // successor: list released retirees in same org
      if (url.pathname === "/api/successor/retirees" && req.method === "GET") {
        const decoded = verifyToken(req.headers.get("Authorization"));
        if (!decoded || decoded.role !== 'successor') return new Response("Unauthorized", { status: 401 });

        try {
          const [successorUser] = await sql`SELECT id, org_id FROM users WHERE id = ${decoded.sub}` as Array<{ id: string; org_id: string }>;
          if (!successorUser) return new Response(JSON.stringify([]), { headers: apiHeaders });

          const retirees = await sql`
            SELECT e.id AS engagement_id, u.full_name, u.job_title, u.id AS retiree_id, e.release_date, e.title
            FROM transfer_engagements e
            JOIN users u ON u.id = e.retiree_id
            WHERE e.org_id = ${successorUser.org_id} AND e.release_date IS NOT NULL
            ORDER BY u.full_name ASC
          `;
          return new Response(JSON.stringify(retirees), { headers: apiHeaders });
        } catch (e: any) {
          return new Response(JSON.stringify({ message: e.message }), { status: 500, headers: apiHeaders });
        }
      }

      // successor chat: reset (delete messages, restore active)
      if (url.pathname.startsWith("/api/successor/chat/") && url.pathname.endsWith("/reset") && req.method === "POST") {
        const decoded = verifyToken(req.headers.get("Authorization"));
        if (!decoded || decoded.role !== 'successor') return new Response("Unauthorized", { status: 401 });

        try {
          const parts = url.pathname.split("/");
          const chatId = parts[parts.length - 2];
          const [owned] = await sql`SELECT id FROM successor_chats WHERE id = ${chatId} AND successor_id = ${decoded.sub}`;
          if (!owned) return new Response(JSON.stringify({ message: "Chat not found" }), { status: 404, headers: apiHeaders });

          await sql`DELETE FROM successor_chat_messages WHERE chat_id = ${chatId}`;
          const [chat] = await sql`
            UPDATE successor_chats
            SET status = 'active', confirmed_at = NULL, updated_at = NOW()
            WHERE id = ${chatId}
            RETURNING *
          `;
          return new Response(JSON.stringify({ chat }), { headers: apiHeaders });
        } catch (e: any) {
          return new Response(JSON.stringify({ message: e.message }), { status: 500, headers: apiHeaders });
        }
      }

      // successor chat: save message
      if (url.pathname === "/api/successor/chat/messages" && req.method === "POST") {
        const decoded = verifyToken(req.headers.get("Authorization"));
        if (!decoded || decoded.role !== 'successor') return new Response("Unauthorized", { status: 401 });

        try {
          const { chat_id, role, content } = await req.json();
          const [chat] = await sql`
            SELECT * FROM successor_chats
            WHERE id = ${chat_id} AND successor_id = ${decoded.sub} AND status = 'active'
          `;
          if (!chat) return new Response(JSON.stringify({ message: "Chat not found or already confirmed" }), { status: 404, headers: apiHeaders });

          const [message] = await sql`
            INSERT INTO successor_chat_messages (chat_id, role, content)
            VALUES (${chat_id}, ${role}, ${content})
            RETURNING *
          `;
          return new Response(JSON.stringify({ message }), { headers: apiHeaders });
        } catch (e: any) {
          return new Response(JSON.stringify({ message: e.message }), { status: 500, headers: apiHeaders });
        }
      }

      // successor chat: confirm/end chat
      if (url.pathname.startsWith("/api/successor/chat/") && url.pathname.endsWith("/confirm") && req.method === "POST") {
        const decoded = verifyToken(req.headers.get("Authorization"));
        if (!decoded || decoded.role !== 'successor') return new Response("Unauthorized", { status: 401 });

        try {
          const parts = url.pathname.split("/");
          const chatId = parts[parts.length - 2];
          const [chat] = await sql`
            UPDATE successor_chats
            SET status = 'confirmed', confirmed_at = NOW(), updated_at = NOW()
            WHERE id = ${chatId} AND successor_id = ${decoded.sub}
            RETURNING *
          `;
          if (!chat) return new Response(JSON.stringify({ message: "Chat not found" }), { status: 404, headers: apiHeaders });
          return new Response(JSON.stringify({ chat }), { headers: apiHeaders });
        } catch (e: any) {
          return new Response(JSON.stringify({ message: e.message }), { status: 500, headers: apiHeaders });
        }
      }

      // successor chat: get or create chat session
      if (url.pathname.startsWith("/api/successor/chat/") && req.method === "GET") {
        const decoded = verifyToken(req.headers.get("Authorization"));
        if (!decoded || decoded.role !== 'successor') return new Response("Unauthorized", { status: 401 });

        try {
          const engagementId = url.pathname.split("/").pop();
          if (!engagementId) return new Response(JSON.stringify({ message: "Engagement not found" }), { status: 404, headers: apiHeaders });

          const [engagement] = await sql`
            SELECT e.*, u.full_name AS retiree_name, u.job_title AS retiree_job_title
            FROM transfer_engagements e
            JOIN users u ON u.id = e.retiree_id
            WHERE e.id = ${engagementId} AND e.release_date IS NOT NULL
          `;
          if (!engagement) return new Response(JSON.stringify({ message: "Knowledge profile not released or not found" }), { status: 404, headers: apiHeaders });

          let [chat] = await sql`
            SELECT * FROM successor_chats
            WHERE engagement_id = ${engagementId} AND successor_id = ${decoded.sub}
          `;
          if (!chat) {
            [chat] = await sql`
              INSERT INTO successor_chats (engagement_id, successor_id, status)
              VALUES (${engagementId}, ${decoded.sub}, 'active')
              RETURNING *
            `;
          }

          const messages = await sql`
            SELECT * FROM successor_chat_messages
            WHERE chat_id = ${chat.id}
            ORDER BY created_at ASC
          `;
          return new Response(JSON.stringify({ chat, messages, engagement }), { headers: apiHeaders });
        } catch (e: any) {
          return new Response(JSON.stringify({ message: e.message }), { status: 500, headers: apiHeaders });
        }
      }

      // successor stream: AI answers using retiree knowledge as context
      if (url.pathname === "/api/successor/stream" && req.method === "POST") {
        const decoded = verifyToken(req.headers.get("Authorization"));
        if (!decoded || decoded.role !== 'successor') return new Response("Unauthorized", { status: 401 });
        if (!genAI) return new Response("AI configuration missing", { status: 500 });

        try {
          const { chatId, engagementId, message } = await req.json();

          if (typeof chatId !== 'string' || typeof engagementId !== 'string' || typeof message !== 'string') {
            return new Response(JSON.stringify({ message: 'Invalid payload' }), { status: 400, headers: apiHeaders });
          }

          const safeMessage = normalizeContextText(message);
          if (!safeMessage) {
            return new Response(JSON.stringify({ message: 'Message is required' }), { status: 400, headers: apiHeaders });
          }

          const [chat] = await sql`
            SELECT * FROM successor_chats
            WHERE id = ${chatId} AND successor_id = ${decoded.sub} AND engagement_id = ${engagementId} AND status = 'active'
          `;
          if (!chat) return new Response("Chat not found or already confirmed", { status: 404 });

          const [engagement] = await sql`
            SELECT e.*, u.full_name AS retiree_name, u.job_title, u.years_exp, o.name AS org_name
            FROM transfer_engagements e
            JOIN users u ON u.id = e.retiree_id
            JOIN organizations o ON o.id = e.org_id
            WHERE e.id = ${engagementId} AND e.release_date IS NOT NULL
          `;
          if (!engagement) return new Response("Engagement not released", { status: 404 });

          const knowledgeProfiles = await sql`
            SELECT section, title, content, quote, knowledge_type
            FROM knowledge_profiles
            WHERE engagement_id = ${engagementId}
            ORDER BY section ASC
            LIMIT 40
          `;

          const interviewExchanges = await sql`
            SELECT x.question_text, x.response_text, s.session_number, s.session_focus
            FROM interview_exchanges x
            JOIN interview_sessions s ON s.id = x.session_id
            WHERE s.engagement_id = ${engagementId} AND x.response_text IS NOT NULL
            ORDER BY s.session_number ASC, x.sequence_order ASC
            LIMIT 72
          `;

          const recentMessages = await sql`
            SELECT role, content FROM successor_chat_messages
            WHERE chat_id = ${chatId}
            ORDER BY created_at ASC
            LIMIT 10
          `;

          const profileContext = knowledgeProfiles.length > 0
            ? limitText(
                knowledgeProfiles
                  .map((p: any) => {
                    const section = asSafeText(p.section || 'general').toUpperCase() || 'GENERAL';
                    const title = asSafeText(p.title) || 'Untitled';
                    const content = asSafeText(p.content) || 'No content captured.';
                    const quote = asSafeText(p.quote);
                    return `[${section}] ${title}\n${content}${quote ? `\nQuote: "${quote}"` : ''}`;
                  })
                  .join('\n\n'),
                12000,
              )
            : 'No structured knowledge profiles captured yet.';

          const exchangeContext = interviewExchanges.length > 0
            ? limitText(
                interviewExchanges
                  .map((x: any, i: number) => {
                    const sessionNumber = Number.isFinite(Number(x.session_number)) ? Number(x.session_number) : '?';
                    const focus = asSafeText(x.session_focus) || 'unspecified';
                    const question = asSafeText(x.question_text) || 'No question captured.';
                    const answer = asSafeText(x.response_text) || 'No answer captured.';
                    return `Session ${sessionNumber} (${focus}) Q${i + 1}: ${question}\nAnswer: ${answer}`;
                  })
                  .join('\n\n'),
                16000,
              )
            : 'No interview transcript available.';

          const chatHistoryContext = recentMessages.length > 0
            ? limitText(
                recentMessages
                  .map((m: any) => `${m.role === 'user' ? 'Successor' : 'AI'}: ${asSafeText(m.content)}`)
                  .join('\n'),
                5000,
              )
            : '';

          const prompt = `You are ExitWise AI, a knowledge access assistant helping a successor employee learn from a retiring colleague's captured institutional knowledge.

RETIREE: ${engagement.retiree_name} | Role: ${engagement.job_title || 'Expert'} | Org: ${engagement.org_name} | ${engagement.years_exp || '?'} years exp

CAPTURED KNOWLEDGE PROFILES:
${profileContext}

INTERVIEW TRANSCRIPT:
${exchangeContext}

${chatHistoryContext ? `CONVERSATION HISTORY:\n${chatHistoryContext}\n` : ''}INSTRUCTIONS:
- Answer ONLY using the captured knowledge above
- If information is not captured, say: "This wasn't captured in the knowledge transfer sessions."
- Be specific and practical for the successor
- Output plain text only. No HTML, markdown, or formatting symbols.

Successor's question: ${safeMessage}`;

          const result = await generateModelStream(prompt);

          const stream = new ReadableStream({
            async start(controller) {
              for await (const chunk of result.stream) {
                const text = typeof chunk?.text === 'function' ? chunk.text() : '';
                if (text) {
                  controller.enqueue(text);
                }
              }
              controller.close();
            },
          });

          return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
        } catch (e: any) {
          console.error('[successor/stream]', e);
          const aiError = parseGeminiError(e);
          const responseHeaders = new Headers(apiHeaders);
          if (aiError.retryAfterSeconds) {
            responseHeaders.set('Retry-After', String(aiError.retryAfterSeconds));
          }
          return new Response(JSON.stringify({ message: aiError.message, detail: aiError.rawMessage }), { status: aiError.status, headers: responseHeaders });
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
