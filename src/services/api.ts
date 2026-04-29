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

export const profileService = {
  getProfile: (engagementId: string) => apiFetch<any>(`/profiles/${engagementId}`),
  queryProfile: (engagementId: string, query: string) => apiFetch<any>(`/profiles/${engagementId}/query`, {
    method: 'POST',
    body: JSON.stringify({ query }),
  }),
};
