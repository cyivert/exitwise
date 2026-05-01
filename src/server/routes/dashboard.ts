import sql from "../../database/db";
import { parseGeminiError } from "../ai/errors";
import { getOrganizationAdminContext } from "../experiences/org-context";
import type { ReleaseDatePayload } from "../types";
import { verifyToken } from "../utils/auth";
import { buildJsonHeaders, unauthorized } from "../utils/response";

// GET /api/dashboard — role-aware dashboard payload.
export async function getDashboard(req: Request): Promise<Response> {
  const decoded = verifyToken(req.headers.get("Authorization"));
  if (!decoded) return unauthorized();

  const headers = buildJsonHeaders();

  try {
    if (decoded.role === "retiree") {
      const [retiree] = await sql`SELECT id, org_id FROM users WHERE id = ${decoded.sub}`;
      if (!retiree) {
        return new Response(
          JSON.stringify({ experiences: [], activeExperience: null, sessions: [] }),
          { headers },
        );
      }

      const experiences = await sql`
        SELECT *
        FROM transfer_engagements
        WHERE retiree_id = ${decoded.sub}
        ORDER BY created_at DESC
      `;

      const activeExperience =
        experiences.find((experience) => experience.status === "active") ||
        experiences[0] ||
        null;
      const sessions = activeExperience
        ? await sql`
            SELECT *
            FROM interview_sessions
            WHERE engagement_id = ${activeExperience.id}
            ORDER BY session_number ASC
          `
        : [];

      return new Response(JSON.stringify({ experiences, activeExperience, sessions }), {
        headers,
      });
    }

    if (decoded.role === "organization_admin" || decoded.role === "admin") {
      const adminContext = await getOrganizationAdminContext(decoded.sub);
      if (!adminContext) {
        return new Response(
          JSON.stringify({ organization: null, members: [], experiences: [] }),
          { headers },
        );
      }
      return new Response(JSON.stringify(adminContext), { headers });
    }

    if (decoded.role === "successor") {
      const [engagement] = await sql`
        SELECT *
        FROM transfer_engagements
        WHERE successor_id = ${decoded.sub}
           OR org_id IN (SELECT org_id FROM users WHERE id = ${decoded.sub})
      `;
      if (!engagement) return new Response(JSON.stringify({ engagement: null }), { headers });
      return new Response(JSON.stringify({ engagement }), { headers });
    }

    return new Response(JSON.stringify({ status: "ok" }), { headers });
  } catch (e: any) {
    // Dashboard wraps a few different downstream calls; fall back to the AI
    // error mapper since some paths may invoke the model.
    const aiError = parseGeminiError(e);
    const responseHeaders = new Headers(headers);
    if (aiError.retryAfterSeconds) {
      responseHeaders.set("Retry-After", String(aiError.retryAfterSeconds));
    }
    return new Response(
      JSON.stringify({ message: aiError.message, detail: aiError.rawMessage }),
      { status: aiError.status, headers: responseHeaders },
    );
  }
}

// POST /api/dashboard/release — set the retiree's release date.
export async function setReleaseDate(req: Request): Promise<Response> {
  const decoded = verifyToken(req.headers.get("Authorization"));
  if (!decoded || decoded.role !== "retiree") return unauthorized();

  const headers = buildJsonHeaders();

  try {
    const { release_date, engagement_id } = (await req.json()) as ReleaseDatePayload;
    if (engagement_id) {
      await sql`
        UPDATE transfer_engagements
        SET release_date = ${release_date}
        WHERE id = ${engagement_id} AND retiree_id = ${decoded.sub}
      `;
    } else {
      await sql`
        UPDATE transfer_engagements
        SET release_date = ${release_date}
        WHERE retiree_id = ${decoded.sub}
      `;
    }
    return new Response(JSON.stringify({ status: "success" }), { headers });
  } catch (e: any) {
    return new Response(JSON.stringify({ message: e.message }), { status: 500, headers });
  }
}
