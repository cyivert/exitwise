import type { SessionFocus, KnowledgeType } from '../types';

export const SESSION_CONFIG: Record<number, { focus: SessionFocus; label: string }> = {
  1: { focus: 'orientation', label: 'Career Orientation' },
  2: { focus: 'processes', label: 'Standard Processes' },
  3: { focus: 'decisions', label: 'Critical Decisions' },
  4: { focus: 'relationships', label: 'Key Relationships' },
  5: { focus: 'edge_cases', label: 'Edge Cases & Exceptions' },
  6: { focus: 'review', label: 'Final Review' },
};

export const KNOWLEDGE_TYPE_LABELS: Record<KnowledgeType, string> = {
  explicit: 'Explicit Knowledge',
  tacit: 'Tacit Knowledge',
  relational: 'Relational Context',
  emergency: 'Emergency Protocol',
  exception: 'Exception Case',
};

export const ROUTES = {
  LANDING: '/',
  LOGIN: '/login',
  SIGNUP: '/signup',
  DASHBOARD: '/dashboard',
  INTERVIEW: '/interview/:sessionId',
  PROFILE: '/profile/:engagementId',
  KNOWLEDGE: '/knowledge',
  KNOWLEDGE_CHAT: '/knowledge/:engagementId',
};

export const COLORS = {
  GREEN_DEEP: '#1a3a2a',
  GREEN_MID: '#2d5a40',
  GREEN_LIGHT: '#4a8c5c',
  GREEN_PALE: '#e8f2eb',
  CREAM: '#f7f3ec',
  CREAM_DARK: '#ede8de',
  AMBER: '#c8892a',
  AMBER_LIGHT: '#f5e6c8',
  RED: '#a32d2d',
  RED_LIGHT: '#fcebeb',
  BLUE: '#185fa5',
  BLUE_LIGHT: '#e6f1fb',
  TEXT_DARK: '#1a1a18',
  TEXT_MID: '#4a4a42',
  TEXT_LIGHT: '#8a8a7a',
};
