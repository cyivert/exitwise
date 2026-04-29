import { create } from 'zustand';
import type { User, AuthState } from '../types';

interface AuthActions {
  setAuth: (user: User, token: string) => void;
  clearAuth: () => void;
}

// no persist. prevent token in localStorage. session only.
export const useAuthStore = create<AuthState & AuthActions>()((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  setAuth: (user, token) => set({ user, token, isAuthenticated: true }),
  clearAuth: () => set({ user: null, token: null, isAuthenticated: false }),
}));
