import sql from "../../database/db";
import { createExperienceForRetiree } from "../experiences/sessions";
import { generateExperienceTitle } from "../experiences/title";
import { verifyToken } from "../utils/auth";
import { buildJsonHeaders, unauthorized } from "../utils/response";

// POST /api/experiences — create an engagement + sessions for the calling retiree.
export async function createExperience(req: Request): Promise<Response> {
  const decoded = verifyToken(req.headers.get("Authorization"));
  if (!decoded || decoded.role !== "retiree") return unauthorized();

  const headers = buildJsonHeaders();

  try {
    const [retiree] = (await sql`
      SELECT id, org_id FROM users WHERE id = ${decoded.sub}
    `) as Array<{ id: string; org_id: string }>;

    if (!retiree) {
      return new Response(JSON.stringify({ message: "Retiree not found" }), {
        status: 404,
        headers,
      });
    }

    const result = await createExperienceForRetiree(retiree);
    return new Response(JSON.stringify(result), { headers });
  } catch (e: any) {
    return new Response(JSON.stringify({ message: e.message }), { status: 500, headers });
  }
}

// POST /api/experiences/:id/title — regenerate a human-readable title.
export async function generateTitle(req: Request, url: URL): Promise<Response> {
  const decoded = verifyToken(req.headers.get("Authorization"));
  if (!decoded || decoded.role !== "retiree") return unauthorized();

  const headers = buildJsonHeaders();

  try {
    const engagementId = url.pathname.split("/")[3];
    if (!engagementId) {
      return new Response(JSON.stringify({ message: "Experience not found" }), {
        status: 404,
        headers,
      });
    }

    const updatedExperience = await generateExperienceTitle(engagementId, decoded.sub);
    return new Response(JSON.stringify({ experience: updatedExperience }), { headers });
  } catch (e: any) {
    return new Response(JSON.stringify({ message: e.message }), { status: 500, headers });
  }
}

// DELETE /api/experiences/:id — remove an experience owned by the calling retiree.
export async function deleteExperience(req: Request, url: URL): Promise<Response> {
  const decoded = verifyToken(req.headers.get("Authorization"));
  if (!decoded || decoded.role !== "retiree") return unauthorized();

  const headers = buildJsonHeaders();

  try {
    const engagementId = url.pathname.split("/").pop();
    if (!engagementId) {
      return new Response(JSON.stringify({ message: "Experience not found" }), {
        status: 404,
        headers,
      });
    }

    const [experience] = await sql`
      SELECT *
      FROM transfer_engagements
      WHERE id = ${engagementId} AND retiree_id = ${decoded.sub}
    `;

    if (!experience) {
      return new Response(JSON.stringify({ message: "Experience not found" }), {
        status: 404,
        headers,
      });
    }

    await sql`DELETE FROM transfer_engagements WHERE id = ${engagementId}`;
    return new Response(JSON.stringify({ status: "success" }), { headers });
  } catch (e: any) {
    return new Response(JSON.stringify({ message: e.message }), { status: 500, headers });
  }
}
