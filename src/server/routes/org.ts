import sql from "../../database/db";
import type { OrgMemberPayload } from "../types";
import { verifyToken } from "../utils/auth";
import { buildJsonHeaders, unauthorized } from "../utils/response";

// Authorization helper — only org admins may modify members.
function isOrgAdmin(role: string | undefined): boolean {
  return role === "organization_admin" || role === "admin";
}

// POST /api/org/members — invite a new member into the admin's organization.
export async function createMember(req: Request): Promise<Response> {
  const decoded = verifyToken(req.headers.get("Authorization"));
  if (!decoded || !isOrgAdmin(decoded.role)) return unauthorized();

  const headers = buildJsonHeaders();

  try {
    const body = (await req.json()) as OrgMemberPayload;
    const { full_name, email, password, role, job_title, years_exp } = body;

    const [adminUser] = (await sql`
      SELECT id, org_id FROM users WHERE id = ${decoded.sub}
    `) as Array<{ id: string; org_id: string }>;

    if (!adminUser) {
      return new Response(JSON.stringify({ message: "Organization admin not found" }), {
        status: 404,
        headers,
      });
    }

    const password_hash = await Bun.password.hash(password);
    const [user] = await sql`
      INSERT INTO users (org_id, email, password_hash, full_name, role, job_title, years_exp)
      VALUES (${adminUser.org_id}, ${email}, ${password_hash}, ${full_name}, ${role}, ${job_title ?? null}, ${years_exp ?? null})
      RETURNING id, org_id, email, full_name, role, job_title, years_exp, created_at
    `;

    return new Response(JSON.stringify({ user }), { headers });
  } catch (e: any) {
    return new Response(JSON.stringify({ message: e.message }), { status: 500, headers });
  }
}

// DELETE /api/org/members/:id — remove a member from the admin's organization.
// Cleans up referenced engagements/successor links so the FK constraints stay valid.
export async function deleteMember(req: Request, url: URL): Promise<Response> {
  const decoded = verifyToken(req.headers.get("Authorization"));
  if (!decoded || !isOrgAdmin(decoded.role)) return unauthorized();

  const headers = buildJsonHeaders();

  try {
    const memberId = url.pathname.split("/").pop();
    // Admins may not delete themselves through this endpoint.
    if (!memberId || memberId === decoded.sub) {
      return new Response(JSON.stringify({ message: "Member not found" }), {
        status: 404,
        headers,
      });
    }

    const [adminUser] = (await sql`
      SELECT id, org_id FROM users WHERE id = ${decoded.sub}
    `) as Array<{ id: string; org_id: string }>;

    if (!adminUser) {
      return new Response(JSON.stringify({ message: "Organization admin not found" }), {
        status: 404,
        headers,
      });
    }

    const [member] = await sql`
      SELECT * FROM users
      WHERE id = ${memberId} AND org_id = ${adminUser.org_id}
    `;

    if (!member) {
      return new Response(JSON.stringify({ message: "Member not found" }), {
        status: 404,
        headers,
      });
    }

    if (member.role === "organization_admin" || member.role === "admin") {
      return new Response(
        JSON.stringify({
          message: "Organization admins cannot be deleted from the dashboard",
        }),
        { status: 400, headers },
      );
    }

    if (member.role === "retiree") {
      await sql`DELETE FROM transfer_engagements WHERE retiree_id = ${memberId}`;
    }

    if (member.role === "successor") {
      await sql`UPDATE transfer_engagements SET successor_id = NULL WHERE successor_id = ${memberId}`;
    }

    await sql`DELETE FROM users WHERE id = ${memberId}`;
    return new Response(JSON.stringify({ status: "success" }), { headers });
  } catch (e: any) {
    return new Response(JSON.stringify({ message: e.message }), { status: 500, headers });
  }
}
