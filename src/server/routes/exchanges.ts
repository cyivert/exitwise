import sql from "../../database/db";
import type { ExchangePayload } from "../types";
import { verifyToken } from "../utils/auth";
import { buildJsonHeaders, unauthorized } from "../utils/response";

// POST /api/exchanges — upsert an interview exchange and append it to the
// engagement's transcript. Idempotent on the exchange id.
export async function saveExchange(req: Request): Promise<Response> {
  const decoded = verifyToken(req.headers.get("Authorization"));
  if (!decoded) return unauthorized();

  const headers = buildJsonHeaders();

  try {
    const {
      id,
      session_id,
      question_text,
      question_type,
      response_text,
      ai_follow_up,
      sequence_order,
    } = (await req.json()) as ExchangePayload;

    const [session] = await sql`
      SELECT s.id, s.session_number, s.session_focus, s.running_summary,
             e.id AS engagement_id, e.org_id, e.retiree_id, e.transcript
      FROM interview_sessions s
      JOIN transfer_engagements e ON e.id = s.engagement_id
      WHERE s.id = ${session_id}
    `;

    if (!session) {
      return new Response(JSON.stringify({ message: "Session not found" }), {
        status: 404,
        headers,
      });
    }

    // Append a summary entry only when this is a fresh user response without
    // an AI follow-up — i.e. the moment the user finishes their turn.
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
      VALUES (${id}, ${session_id}, ${session.org_id}, ${session.retiree_id}, ${question_text}, ${question_type}, ${response_text ?? null}, ${ai_follow_up ?? null}, ${sequence_order ?? 0})
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

    // Maintain a denormalised transcript on the engagement for fast reads.
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

    return new Response(JSON.stringify({ status: "success" }), { headers });
  } catch (e: any) {
    return new Response(JSON.stringify({ message: e.message }), { status: 500, headers });
  }
}
