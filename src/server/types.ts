// Request payload types used by the server route handlers.
// Duplicated rather than imported from src/types/ so that the server
// remains decoupled from client-side code paths.

export type DemoUser = {
  id: string;
  org_id: string;
  email: string;
  password_hash: string;
  full_name: string;
  role: string;
  job_title?: string | null;
  years_exp?: number | null;
  created_at: string;
};

export type ExchangePayload = {
  id: string;
  session_id: string;
  question_text: string;
  question_type: string;
  response_text?: string | null;
  ai_follow_up?: string | null;
  sequence_order?: number;
};

export type OrgMemberPayload = {
  full_name: string;
  email: string;
  password: string;
  role: string;
  job_title?: string | null;
  years_exp?: number | null;
};

// engagement_id is optional — server can resolve the active engagement
// for the authenticated retiree if it is omitted.
export type ReleaseDatePayload = {
  release_date: string;
  engagement_id?: string;
};

export type InterviewStreamPayload = {
  sessionId: string;
  userResponse: string;
};

export type SuccessorChatMessagePayload = {
  chat_id: string;
  role: string;
  content: string;
};

export type SuccessorStreamPayload = {
  chatId: string;
  engagementId: string;
  message: string;
};

// JWT payload shape — sub is the user id, role is the user's role.
export type AuthPayload = {
  sub: string;
  role: string;
};
