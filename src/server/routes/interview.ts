import sql from "../../database/db";
import { genAI } from "../ai/gemini";
import { generateModelStream } from "../ai/provider";
import { SECURITY_HEADERS } from "../config";
import type { InterviewStreamPayload } from "../types";
import { verifyToken } from "../utils/auth";
import { buildJsonHeaders, unauthorized } from "../utils/response";
import { normalizeContextText } from "../utils/text";

// POST /api/interview/stream — stream the AI interviewer's next question for
// a given session, using session context and recent exchanges as priming.
export async function streamInterview(req: Request): Promise<Response> {
  const decoded = verifyToken(req.headers.get("Authorization"));
  if (!decoded || decoded.role !== "retiree") return unauthorized();
  if (!genAI) return new Response("AI configuration missing", { status: 500 });

  const headers = buildJsonHeaders();

  try {
    const { sessionId, userResponse } = (await req.json()) as InterviewStreamPayload;

    const [session] = await sql`
      SELECT s.*, e.org_id, e.retiree_id, u.full_name AS retiree_name, u.job_title, u.years_exp, o.name AS org_name
      FROM interview_sessions s
      JOIN transfer_engagements e ON e.id = s.engagement_id
      JOIN users u ON u.id = e.retiree_id
      JOIN organizations o ON o.id = e.org_id
      WHERE s.id = ${sessionId}
    `;

    if (!session) return new Response("Session not found", { status: 404 });

    const recentExchanges = await sql`
      SELECT question_text, response_text, ai_follow_up, sequence_order, created_at
      FROM interview_exchanges
      WHERE session_id = ${sessionId}
      ORDER BY created_at ASC
      LIMIT 6
    `;

    const exchangeContext = recentExchanges
      .map((exchange, index) => {
        const response = exchange.response_text
          ? normalizeContextText(exchange.response_text)
          : "No response saved yet.";
        const followUp = exchange.ai_follow_up
          ? normalizeContextText(exchange.ai_follow_up)
          : "No follow-up saved yet.";
        return `${index + 1}. Q: ${normalizeContextText(exchange.question_text)}\n   A: ${response}\n   Follow-up: ${followUp}`;
      })
      .join("\n");

    const prompt = `
      You are ExitWise AI. You interview retiring employees to extract tacit knowledge.
      Retiree: ${session.retiree_name}, ${session.job_title || "Expert"}, ${session.years_exp || 20} years exp.
      Organization: ${session.org_name}.
      Session: ${session.session_number} - Focus: ${session.session_focus}.
      Preserve the concrete knowledge the retiree is trying to hand off to the next hires.

      History Summary: ${JSON.stringify(session.running_summary)}
      Recent Exchanges:\n${exchangeContext || "No exchanges saved yet."}

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
          const text = typeof chunk?.text === "function" ? chunk.text() : "";
          if (text) {
            controller.enqueue(text);
          }
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: { ...SECURITY_HEADERS, "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ message: e.message }), { status: 500, headers });
  }
}
