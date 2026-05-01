import sql from "../../database/db";
import { parseGeminiError } from "../ai/errors";
import { genAI } from "../ai/gemini";
import { generateModelStream } from "../ai/provider";
import type { SuccessorChatMessagePayload, SuccessorStreamPayload } from "../types";
import { verifyToken } from "../utils/auth";
import { buildJsonHeaders, unauthorized } from "../utils/response";
import { asSafeText, limitText, normalizeContextText } from "../utils/text";

// GET /api/successor/retirees — released retirees in the successor's org.
export async function listRetirees(req: Request): Promise<Response> {
  const decoded = verifyToken(req.headers.get("Authorization"));
  if (!decoded || decoded.role !== "successor") return unauthorized();

  const headers = buildJsonHeaders();

  try {
    const [successorUser] = (await sql`
      SELECT id, org_id FROM users WHERE id = ${decoded.sub}
    `) as Array<{ id: string; org_id: string }>;

    if (!successorUser) return new Response(JSON.stringify([]), { headers });

    const retirees = await sql`
      SELECT e.id AS engagement_id, u.full_name, u.job_title, u.id AS retiree_id, e.release_date, e.title
      FROM transfer_engagements e
      JOIN users u ON u.id = e.retiree_id
      WHERE e.org_id = ${successorUser.org_id} AND e.release_date IS NOT NULL
      ORDER BY u.full_name ASC
    `;
    return new Response(JSON.stringify(retirees), { headers });
  } catch (e: any) {
    return new Response(JSON.stringify({ message: e.message }), { status: 500, headers });
  }
}

// POST /api/successor/chat/:id/reset — wipe messages and reactivate a chat.
export async function resetChat(req: Request, url: URL): Promise<Response> {
  const decoded = verifyToken(req.headers.get("Authorization"));
  if (!decoded || decoded.role !== "successor") return unauthorized();

  const headers = buildJsonHeaders();

  try {
    const parts = url.pathname.split("/");
    const chatId = parts[parts.length - 2];

    const [owned] = await sql`
      SELECT id FROM successor_chats WHERE id = ${chatId} AND successor_id = ${decoded.sub}
    `;
    if (!owned) {
      return new Response(JSON.stringify({ message: "Chat not found" }), {
        status: 404,
        headers,
      });
    }

    await sql`DELETE FROM successor_chat_messages WHERE chat_id = ${chatId}`;
    const [chat] = await sql`
      UPDATE successor_chats
      SET status = 'active', confirmed_at = NULL, updated_at = NOW()
      WHERE id = ${chatId}
      RETURNING *
    `;
    return new Response(JSON.stringify({ chat }), { headers });
  } catch (e: any) {
    return new Response(JSON.stringify({ message: e.message }), { status: 500, headers });
  }
}

// POST /api/successor/chat/messages — append a message to an active chat.
export async function saveChatMessage(req: Request): Promise<Response> {
  const decoded = verifyToken(req.headers.get("Authorization"));
  if (!decoded || decoded.role !== "successor") return unauthorized();

  const headers = buildJsonHeaders();

  try {
    const { chat_id, role, content } = (await req.json()) as SuccessorChatMessagePayload;

    const [chat] = await sql`
      SELECT * FROM successor_chats
      WHERE id = ${chat_id} AND successor_id = ${decoded.sub} AND status = 'active'
    `;
    if (!chat) {
      return new Response(JSON.stringify({ message: "Chat not found or already confirmed" }), {
        status: 404,
        headers,
      });
    }

    const [message] = await sql`
      INSERT INTO successor_chat_messages (chat_id, role, content)
      VALUES (${chat_id}, ${role}, ${content})
      RETURNING *
    `;
    return new Response(JSON.stringify({ message }), { headers });
  } catch (e: any) {
    return new Response(JSON.stringify({ message: e.message }), { status: 500, headers });
  }
}

// POST /api/successor/chat/:id/confirm — mark a chat as confirmed/closed.
export async function confirmChat(req: Request, url: URL): Promise<Response> {
  const decoded = verifyToken(req.headers.get("Authorization"));
  if (!decoded || decoded.role !== "successor") return unauthorized();

  const headers = buildJsonHeaders();

  try {
    const parts = url.pathname.split("/");
    const chatId = parts[parts.length - 2];

    const [chat] = await sql`
      UPDATE successor_chats
      SET status = 'confirmed', confirmed_at = NOW(), updated_at = NOW()
      WHERE id = ${chatId} AND successor_id = ${decoded.sub}
      RETURNING *
    `;
    if (!chat) {
      return new Response(JSON.stringify({ message: "Chat not found" }), {
        status: 404,
        headers,
      });
    }
    return new Response(JSON.stringify({ chat }), { headers });
  } catch (e: any) {
    return new Response(JSON.stringify({ message: e.message }), { status: 500, headers });
  }
}

// GET /api/successor/chat/:engagementId — fetch (or lazily create) a chat.
export async function getOrCreateChat(req: Request, url: URL): Promise<Response> {
  const decoded = verifyToken(req.headers.get("Authorization"));
  if (!decoded || decoded.role !== "successor") return unauthorized();

  const headers = buildJsonHeaders();

  try {
    const engagementId = url.pathname.split("/").pop();
    if (!engagementId) {
      return new Response(JSON.stringify({ message: "Engagement not found" }), {
        status: 404,
        headers,
      });
    }

    const [engagement] = await sql`
      SELECT e.*, u.full_name AS retiree_name, u.job_title AS retiree_job_title
      FROM transfer_engagements e
      JOIN users u ON u.id = e.retiree_id
      WHERE e.id = ${engagementId} AND e.release_date IS NOT NULL
    `;
    if (!engagement) {
      return new Response(
        JSON.stringify({ message: "Knowledge profile not released or not found" }),
        { status: 404, headers },
      );
    }

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
    return new Response(JSON.stringify({ chat, messages, engagement }), { headers });
  } catch (e: any) {
    return new Response(JSON.stringify({ message: e.message }), { status: 500, headers });
  }
}

// POST /api/successor/stream — stream a Q&A response from the captured retiree
// knowledge base for this engagement.
export async function streamSuccessorChat(req: Request): Promise<Response> {
  const decoded = verifyToken(req.headers.get("Authorization"));
  if (!decoded || decoded.role !== "successor") return unauthorized();
  if (!genAI) return new Response("AI configuration missing", { status: 500 });

  const headers = buildJsonHeaders();

  try {
    const { chatId, engagementId, message } = (await req.json()) as SuccessorStreamPayload;

    if (
      typeof chatId !== "string" ||
      typeof engagementId !== "string" ||
      typeof message !== "string"
    ) {
      return new Response(JSON.stringify({ message: "Invalid payload" }), {
        status: 400,
        headers,
      });
    }

    const safeMessage = normalizeContextText(message);
    if (!safeMessage) {
      return new Response(JSON.stringify({ message: "Message is required" }), {
        status: 400,
        headers,
      });
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

    // Knowledge base context, capped to keep prompts within model limits.
    const profileContext =
      knowledgeProfiles.length > 0
        ? limitText(
            knowledgeProfiles
              .map((p: any) => {
                const section = asSafeText(p.section || "general").toUpperCase() || "GENERAL";
                const title = asSafeText(p.title) || "Untitled";
                const content = asSafeText(p.content) || "No content captured.";
                const quote = asSafeText(p.quote);
                return `[${section}] ${title}\n${content}${quote ? `\nQuote: "${quote}"` : ""}`;
              })
              .join("\n\n"),
            12000,
          )
        : "No structured knowledge profiles captured yet.";

    const exchangeContext =
      interviewExchanges.length > 0
        ? limitText(
            interviewExchanges
              .map((x: any, i: number) => {
                const sessionNumber = Number.isFinite(Number(x.session_number))
                  ? Number(x.session_number)
                  : "?";
                const focus = asSafeText(x.session_focus) || "unspecified";
                const question = asSafeText(x.question_text) || "No question captured.";
                const answer = asSafeText(x.response_text) || "No answer captured.";
                return `Session ${sessionNumber} (${focus}) Q${i + 1}: ${question}\nAnswer: ${answer}`;
              })
              .join("\n\n"),
            16000,
          )
        : "No interview transcript available.";

    const chatHistoryContext =
      recentMessages.length > 0
        ? limitText(
            recentMessages
              .map((m: any) => `${m.role === "user" ? "Successor" : "AI"}: ${asSafeText(m.content)}`)
              .join("\n"),
            5000,
          )
        : "";

    const isGreeting =
      /^(hi|hello|hey|howdy|greetings|sup|yo|good morning|good afternoon|good evening)[\s!?.]*$/i.test(
        safeMessage.trim(),
      );

    const prompt = `You are the captured voice of ${engagement.retiree_name}, a ${engagement.job_title || "expert"} with ${engagement.years_exp || "many"} years at ${engagement.org_name}. You speak from their recorded knowledge to help their successor.

CAPTURED KNOWLEDGE PROFILES:
${profileContext}

INTERVIEW TRANSCRIPT:
${exchangeContext}

${chatHistoryContext ? `CONVERSATION HISTORY:\n${chatHistoryContext}\n` : ""}TONE AND STYLE RULES:
- Sound like a knowledgeable colleague having a real conversation, not a report generator
- Keep answers short and direct — 2 to 4 sentences for simple questions
- For multi-part answers, use 3 to 5 short bullet points max, no long numbered lists
- Refer to yourself as drawing from ${engagement.retiree_name}'s experience: "From what I know...", "In my experience here...", "What worked for me was..."
- If a greeting (Hi, Hello, Hey, etc.): respond warmly, say who you are, and naturally mention 2 to 3 areas you can help with based on the captured knowledge
- If info wasn't captured, say: "I don't think we covered that in our sessions — try asking your manager or team."
- Plain text only. No markdown, no symbols, no numbered lists with periods.

Successor's message: ${safeMessage}${isGreeting ? "\n\n(This is a greeting — introduce yourself warmly and offer help areas based on the knowledge above. Keep it brief, 3 to 4 sentences max.)" : ""}`;

    const result = await generateModelStream(prompt);

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
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (e: any) {
    console.error("[successor/stream]", e);
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

// Profile fetch route lives here too since it is successor-facing in spirit;
// in the real API there is no implementation, so we match the original 404 behavior
// by leaving it unrouted (handled by the API 404 fallback in the router).
