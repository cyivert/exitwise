import type { ApiResponse, LoginCredentials, SignupData, User } from '../types';
import { env } from '../config/env';
import { useAuthStore } from '../store/authStore';

// /caveman: typed fetch wrapper. ensure /api prefix.
async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const { token } = useAuthStore.getState();
  
  const headers = new Headers(options.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  headers.set('Content-Type', 'application/json');

  // /caveman: enforce /api prefix if missing.
  const path = endpoint.startsWith('/api') ? endpoint : `/api${endpoint}`;

  try {
    const response = await fetch(`${env.VITE_API_URL}${path}`, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      return { error: data.message || 'API request failed' };
    }

    return { data };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export const authService = {
  login: (credentials: LoginCredentials) => apiFetch<{ user: User; token: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  }),
  signup: (data: SignupData) => apiFetch<{ user: User; token: string }>('/auth/signup', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
};

export const interviewService = {
  getSessions: (engagementId: string) => apiFetch<any[]>(`/sessions?engagement_id=${engagementId}`),
  getSession: (sessionId: string) => apiFetch<any>(`/sessions/${sessionId}`),
  saveExchange: (exchange: any) => apiFetch<any>('/exchanges', {
    method: 'POST',
    body: JSON.stringify(exchange),
  }),
};

export const dashboardService = {
  getDashboard: () => apiFetch<{ experiences?: any[]; activeExperience?: any; sessions?: any[]; organization?: any; members?: any[]; engagement?: any }>('/dashboard'),
  createExperience: () => apiFetch<any>('/experiences', {
    method: 'POST',
  }),
  renameExperienceTitle: (experienceId: string) => apiFetch<any>(`/experiences/${experienceId}/title`, {
    method: 'POST',
  }),
  deleteExperience: (experienceId: string) => apiFetch<any>(`/experiences/${experienceId}`, {
    method: 'DELETE',
  }),
  updateReleaseDate: (date: string, experienceId?: string) => apiFetch<any>('/dashboard/release', {
    method: 'POST',
    body: JSON.stringify({ release_date: date, engagement_id: experienceId }),
  }),
  createOrgMember: (member: { full_name: string; email: string; password: string; role: string; job_title?: string; years_exp?: number }) => apiFetch<any>('/org/members', {
    method: 'POST',
    body: JSON.stringify(member),
  }),
  deleteOrgMember: (memberId: string) => apiFetch<any>(`/org/members/${memberId}`, {
    method: 'DELETE',
  }),
};

export const successorChatService = {
  getRetirees: () => apiFetch<any[]>('/successor/retirees'),
  getOrCreateChat: (engagementId: string) => apiFetch<any>(`/successor/chat/${engagementId}`),
  saveMessage: (payload: { chat_id: string; role: 'user' | 'assistant'; content: string }) =>
    apiFetch<any>('/successor/chat/messages', { method: 'POST', body: JSON.stringify(payload) }),
  confirmChat: (chatId: string) =>
    apiFetch<any>(`/successor/chat/${chatId}/confirm`, { method: 'POST' }),
  resetChat: (chatId: string) =>
    apiFetch<any>(`/successor/chat/${chatId}/reset`, { method: 'POST' }),
};

export const profileService = {
  getProfile: (engagementId: string) => apiFetch<any>(`/profiles/${engagementId}`),
  queryProfile: (engagementId: string, query: string) => apiFetch<any>(`/profiles/${engagementId}/query`, {
    method: 'POST',
    body: JSON.stringify({ query }),
  }),
};
