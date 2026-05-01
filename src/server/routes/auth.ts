import sql from "../../database/db";
import { loginSchema, signupSchema } from "../../schemas/auth";
import { z } from "zod";
import { createExperienceForRetiree } from "../experiences/sessions";
import { signToken } from "../utils/auth";
import { checkRateLimit } from "../utils/rate-limit";
import { buildJsonHeaders } from "../utils/response";

// POST /api/auth/signup — create a user (with new org or via invite code).
export async function signup(req: Request): Promise<Response> {
  const headers = buildJsonHeaders();

  try {
    const body = await req.json();
    const validated = signupSchema.parse(body);
    const { email, password, full_name, org_name, invite_code } = validated;
    let { role } = validated;

    const ip = req.headers.get("x-forwarded-for") || "unknown";
    if (checkRateLimit(`signup:${ip}`)) {
      return new Response(JSON.stringify({ message: "Too many requests" }), {
        status: 429,
        headers,
      });
    }

    let org_id: string;

    if (invite_code) {
      const [org] = await sql`SELECT id FROM organizations WHERE invite_code = ${invite_code}`;
      if (!org) {
        return new Response(JSON.stringify({ message: "Invalid invite code" }), {
          status: 400,
          headers,
        });
      }
      org_id = org.id;
    } else if (org_name) {
      // First user of a brand new org becomes its admin.
      const [org] = await sql`
        INSERT INTO organizations (name, industry, invite_code)
        VALUES (${org_name}, 'other', substring(gen_random_uuid()::text, 1, 8))
        RETURNING id
      `;
      org_id = org.id;
      role = "organization_admin";
    } else {
      return new Response(
        JSON.stringify({ message: "Organization name or invite code required" }),
        { status: 400, headers },
      );
    }

    const password_hash = await Bun.password.hash(password);
    const [user] = await sql`
      INSERT INTO users (org_id, email, password_hash, full_name, role)
      VALUES (${org_id}, ${email}, ${password_hash}, ${full_name}, ${role})
      RETURNING id, org_id, email, full_name, role, created_at
    `;
    const token = signToken({ sub: user.id, role: user.role });
    return new Response(JSON.stringify({ user, token }), { headers });
  } catch (e: any) {
    const message = e instanceof z.ZodError ? e.issues[0].message : e.message;
    return new Response(JSON.stringify({ message }), { status: 400, headers });
  }
}

// POST /api/auth/login — verify credentials and issue a JWT.
export async function login(req: Request): Promise<Response> {
  const headers = buildJsonHeaders();

  try {
    const body = await req.json();
    const validated = loginSchema.parse(body);
    const { email, password } = validated;

    const ip = req.headers.get("x-forwarded-for") || "unknown";
    if (checkRateLimit(`login:${ip}:${email}`)) {
      return new Response(JSON.stringify({ message: "Too many attempts" }), {
        status: 429,
        headers,
      });
    }

    const [user] = await sql`SELECT * FROM users WHERE email = ${email}`;
    if (!user || !(await Bun.password.verify(password, user.password_hash))) {
      return new Response(JSON.stringify({ message: "Invalid credentials" }), {
        status: 401,
        headers,
      });
    }

    // Auto-provision an engagement + sessions for retirees on first login.
    if (user.role === "retiree") {
      const [engagement] = await sql`
        SELECT id FROM transfer_engagements WHERE retiree_id = ${user.id}
      `;
      if (!engagement) {
        await createExperienceForRetiree({ id: user.id, org_id: user.org_id });
      }
    }

    const userSafe = { ...user };
    delete (userSafe as typeof user & { password_hash?: string }).password_hash;
    const token = signToken({ sub: user.id, role: user.role });
    return new Response(JSON.stringify({ user: userSafe, token }), { headers });
  } catch (e: any) {
    const message = e instanceof z.ZodError ? e.issues[0].message : e.message;
    return new Response(JSON.stringify({ message }), { status: 400, headers });
  }
}
