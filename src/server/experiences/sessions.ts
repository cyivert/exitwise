import sql from "../../database/db";

// Ordered focus topics for the six-session knowledge-transfer interview.
// The order is meaningful — sessions are created in this sequence and the
// first one is marked "active" by default.
export const SESSION_FOCUS_SEQUENCE = [
  "orientation",
  "processes",
  "decisions",
  "relationships",
  "edge_cases",
  "review",
] as const;

// Insert one interview_sessions row per focus topic. Returns the inserted rows.
export async function createExperienceSessions(
  engagementId: string,
  orgId: string,
  retireeId: string,
) {
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

// Create an active transfer_engagements row for a retiree and seed its sessions.
export async function createExperienceForRetiree(retiree: { id: string; org_id: string }) {
  const [engagement] = await sql`
    INSERT INTO transfer_engagements (org_id, retiree_id, status)
    VALUES (${retiree.org_id}, ${retiree.id}, 'active')
    RETURNING *
  `;

  const sessions = await createExperienceSessions(engagement.id, retiree.org_id, retiree.id);
  return { engagement, sessions };
}
