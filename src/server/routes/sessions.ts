import sql from "../../database/db";
import { verifyToken } from "../utils/auth";
import { buildJsonHeaders, unauthorized } from "../utils/response";

// GET /api/sessions?engagement_id=... — list sessions for an engagement.
export async function listSessions(req: Request, url: URL): Promise<Response> {
  const decoded = verifyToken(req.headers.get("Authorization"));
  if (!decoded) return unauthorized();

  const headers = buildJsonHeaders();

  try {
    const engagementId = url.searchParams.get("engagement_id");
    if (!engagementId) {
      return new Response(JSON.stringify([]), { headers });
    }

    const sessions = await sql`
      SELECT * FROM interview_sessions
      WHERE engagement_id = ${engagementId}
      ORDER BY session_number ASC
    `;

    return new Response(JSON.stringify(sessions), { headers });
  } catch (e: any) {
    return new Response(JSON.stringify({ message: e.message }), { status: 500, headers });
  }
}

// GET /api/sessions/:id — return one session along with its exchanges and the
// engagement transcript for context.
export async function getSession(req: Request, url: URL): Promise<Response> {
  const decoded = verifyToken(req.headers.get("Authorization"));
  if (!decoded) return unauthorized();

  const headers = buildJsonHeaders();
  const sessionId = url.pathname.split("/").pop();

  if (!sessionId) {
    return new Response(JSON.stringify({ message: "Session not found" }), {
      status: 404,
      headers,
    });
  }

  try {
    const [session] = await sql`SELECT * FROM interview_sessions WHERE id = ${sessionId}`;
    if (!session) {
      return new Response(JSON.stringify({ message: "Session not found" }), {
        status: 404,
        headers,
      });
    }

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

    const sessionExchanges = experienceExchanges.filter(
      (exchange) => exchange.session_id === sessionId,
    );

    const [latestExchange] = await sql`
      SELECT * FROM interview_exchanges
      WHERE session_id = ${sessionId}
      ORDER BY created_at DESC
      LIMIT 1
    `;

    return new Response(
      JSON.stringify({
        ...session,
        experience_transcript: experience?.transcript ?? [],
        latest_exchange: latestExchange ?? null,
        session_exchanges: sessionExchanges,
        experience_exchanges: experienceExchanges,
      }),
      { headers },
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ message: e.message }), { status: 500, headers });
  }
}

// POST /api/interview/session/:id/complete — flag a session as complete.
export async function completeSession(req: Request, url: URL): Promise<Response> {
  const decoded = verifyToken(req.headers.get("Authorization"));
  if (!decoded) return unauthorized();

  const headers = buildJsonHeaders();
  // URL shape: /api/interview/session/:id/complete
  const sessionId = url.pathname.split("/")[4];

  try {
    await sql`
      UPDATE interview_sessions SET status = 'complete'
      WHERE id = ${sessionId} AND retiree_id = ${decoded.sub}
    `;
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
  } catch (e: any) {
    return new Response(JSON.stringify({ message: e.message }), { status: 500, headers });
  }
}
