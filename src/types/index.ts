export const VERSION = '0.1.0';
export type UserRole = 'admin' | 'retiree' | 'successor';
export type EngagementStatus = 'pending' | 'active' | 'complete';
export type SessionStatus = 'pending' | 'active' | 'complete';
export type QuestionType = 'anchor' | 'probe' | 'scenario' | 'contrast' | 'legacy' | 'gap_fill';
export type KnowledgeType = 'explicit' | 'tacit' | 'relational' | 'emergency' | 'exception';
export type SessionFocus = 'orientation' | 'processes' | 'decisions' | 'relationships' | 'edge_cases' | 'review';

export interface User {
  id: string;
  org_id: string;
  email: string;
  full_name: string;
  role: UserRole;
  job_title?: string;
  years_exp?: number;
  created_at: string;
  updated_at: string;
}

export interface Organization {
  id: string;
  name: string;
  industry: 'trades' | 'municipal' | 'healthcare' | 'energy' | 'other';
  created_at: string;
}

export interface TransferEngagement {
  id: string;
  org_id: string;
  retiree_id: string;
  successor_id?: string;
  retirement_date: string;
  release_date?: string;
  status: EngagementStatus;
  created_at: string;
}

export interface InterviewSession {
  id: string;
  engagement_id: string;
  session_number: number;
  session_focus: SessionFocus;
  status: SessionStatus;
  running_summary: string[]; // /caveman: compressed history for Gemini
  completed_at?: string;
  created_at: string;
}

export interface InterviewExchange {
  id: string;
  session_id: string;
  question_text: string;
  question_type: QuestionType;
  response_text?: string;
  ai_follow_up?: string;
  knowledge_type?: KnowledgeType;
  sequence_order: number;
  created_at: string;
}

export interface KnowledgeProfile {
  id: string;
  engagement_id: string;
  section: 'processes' | 'decisions' | 'relationships' | 'edge_cases' | 'unwritten_rules' | 'advice';
  title: string;
  content: string;
  quote?: string;
  knowledge_type: KnowledgeType;
  created_at: string;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}

export interface LoginCredentials {
  email: string;
  password?: string;
}

export interface SignupData {
  email: string;
  password?: string;
  full_name: string;
  role: UserRole;
  org_name?: string;
}
