import { SESSION_FOCUS_SEQUENCE } from "../experiences/sessions";
import type { DemoUser } from "../types";

// In-memory data stores used when the configured DATABASE_URL points at a
// host this process cannot reach (typically Railway private hosts).
// All state is lost on restart; this is by design for local prototyping.

export const demoOrg = {
  id: "demo-org",
  name: "Local Demo Organization",
  industry: "other",
  invite_code: "DEMO2026",
};

export const demoUsers = new Map<string, DemoUser>();
export const demoExperiences = new Map<string, any>();
export const demoSessions = new Map<string, any>();
export const demoExchanges = new Map<string, any[]>();

// Strip sensitive fields before returning a user to clients.
export function toSafeUser(user: DemoUser) {
  return {
    id: user.id,
    org_id: user.org_id,
    email: user.email,
    full_name: user.full_name,
    role: user.role,
    job_title: user.job_title,
    years_exp: user.years_exp,
    created_at: user.created_at,
  };
}

// Lazily create a demo experience and its six sessions for a retiree.
// Idempotent — returns the existing engagement if one already exists.
export function makeDemoExperience(user: DemoUser) {
  const existing = [...demoExperiences.values()].find(
    (experience) => experience.retiree_id === user.id,
  );
  if (existing) return existing;

  const now = new Date().toISOString();
  const engagement = {
    id: crypto.randomUUID(),
    org_id: user.org_id,
    retiree_id: user.id,
    successor_id: null,
    title: `${user.job_title || "Retiree"} Knowledge Transfer`,
    status: "active",
    release_date: null,
    transcript: [],
    created_at: now,
    updated_at: now,
  };

  demoExperiences.set(engagement.id, engagement);

  SESSION_FOCUS_SEQUENCE.forEach((session_focus, index) => {
    const session = {
      id: crypto.randomUUID(),
      engagement_id: engagement.id,
      org_id: user.org_id,
      retiree_id: user.id,
      session_number: index + 1,
      session_focus,
      // First session is active; the rest are pending until the user advances.
      status: index === 0 ? "active" : "pending",
      running_summary: [],
      created_at: now,
    };
    demoSessions.set(session.id, session);
    demoExchanges.set(session.id, []);
  });

  return engagement;
}
