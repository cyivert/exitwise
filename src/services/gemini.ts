import { env } from '../config/env';
import { useAuthStore } from '../store/authStore';

// /caveman: stream ai via backend proxy. hide keys.
export async function* streamInterviewResponse(sessionId: string, userResponse: string) {
  const { token } = useAuthStore.getState();

  const response = await fetch(`${env.VITE_API_URL}/api/interview/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ sessionId, userResponse }),
  });

  if (!response.ok) throw new Error('AI stream failed');

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  if (!reader) return;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    yield decoder.decode(value, { stream: true });
  }
}

export async function* streamSuccessorQuery(chatId: string, engagementId: string, message: string) {
  const { token } = useAuthStore.getState();

  const response = await fetch(`${env.VITE_API_URL}/api/successor/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ chatId, engagementId, message }),
  });

  if (!response.ok) {
    let errorMessage = 'AI stream failed';
    try {
      const payload = await response.json();
      if (payload && typeof payload.message === 'string' && payload.message.trim()) {
        errorMessage = payload.message;
      }
    } catch {
      // ignore json parse errors and use fallback message.
    }
    throw new Error(errorMessage);
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  if (!reader) return;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    yield decoder.decode(value, { stream: true });
  }
}
