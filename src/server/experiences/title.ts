import sql from "../../database/db";
import { generateModelText } from "../ai/provider";
import { normalizeContextText } from "../utils/text";

// Shape of the rows returned by the exchange query used to build a title.
type ExperienceTitleExchange = {
  session_number: number;
  session_focus: string;
  question_text: string;
  response_text?: string | null;
  ai_follow_up?: string | null;
};

// Build a deterministic title from the most recent exchange when the model
// fails or returns nothing usable.
export function buildFallbackExperienceTitle(
  experience: { retiree_name?: string; job_title?: string | null; org_name?: string },
  exchanges: ExperienceTitleExchange[],
): string {
  const sourceText =
    [...exchanges]
      .reverse()
      .map((exchange) =>
        normalizeContextText(
          exchange.response_text || exchange.ai_follow_up || exchange.question_text,
        ),
      )
      .find((text) => text.length >= 24) || "";

  const compactTitle = sourceText
    .replace(/["'`]/g, "")
    .replace(/[!?】【。:,;()[\]{}]/g, "")
    .split(/\s+/)
    .slice(0, 5)
    .join(" ")
    .trim();

  if (compactTitle) {
    return compactTitle.charAt(0).toUpperCase() + compactTitle.slice(1);
  }

  return `${experience.job_title || "Retiree"} Knowledge Transfer`;
}

// Generate a human-readable title for an experience using the configured AI
// provider. Persists and returns the updated row.
export async function generateExperienceTitle(engagementId: string, retireeId: string) {
  const [experience] = await sql`
    SELECT e.id, e.title, e.status, u.full_name AS retiree_name, u.job_title, o.name AS org_name
    FROM transfer_engagements e
    JOIN users u ON u.id = e.retiree_id
    JOIN organizations o ON o.id = e.org_id
    WHERE e.id = ${engagementId} AND e.retiree_id = ${retireeId}
  `;

  if (!experience) {
    throw new Error("Experience not found");
  }

  const exchanges = await sql<ExperienceTitleExchange[]>`
    SELECT s.session_number, s.session_focus, x.question_text, x.response_text, x.ai_follow_up, x.created_at
    FROM interview_sessions s
    JOIN interview_exchanges x ON x.session_id = s.id
    WHERE s.engagement_id = ${engagementId}
    ORDER BY s.session_number ASC, x.created_at ASC
    LIMIT 18
  `;

  const exchangeContext = exchanges
    .map((exchange, index) => {
      const response = exchange.response_text
        ? normalizeContextText(exchange.response_text)
        : "No response saved.";
      const followUp = exchange.ai_follow_up
        ? normalizeContextText(exchange.ai_follow_up)
        : "No follow-up saved.";
      return `${index + 1}. Session ${exchange.session_number} (${exchange.session_focus})\nQ: ${normalizeContextText(exchange.question_text)}\nA: ${response}\nFollow-up: ${followUp}`;
    })
    .join("\n\n");

  const prompt = `
    You are naming a retiree knowledge-transfer experience for ExitWise.
    Create a concise, human-readable title under 7 words.
    The title should reflect the substance of the retiree's knowledge, not the organization name.
    Return only the title text. Do not use quotes, bullets, labels, or punctuation at the end.

    Retiree: ${experience.retiree_name}
    Role: ${experience.job_title || "Expert Retiree"}
    Organization: ${experience.org_name}
    Current Title: ${experience.title || "Untitled experience"}

    Session Evidence:
    ${exchangeContext || "No exchanges available yet."}
  `;

  let cleanedTitle = "";

  try {
    const generatedText = await generateModelText(prompt);
    if (generatedText) {
      cleanedTitle = normalizeContextText(generatedText)
        .replace(/^title:\s*/i, "")
        .replace(/^['"`]|['"`]$/g, "")
        .replace(/[.]+$/g, "")
        .trim();
    }
  } catch {
    cleanedTitle = "";
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
