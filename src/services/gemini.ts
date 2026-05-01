import { env } from '../config/env';
import { useAuthStore } from '../store/authStore';

// stream ai via backend proxy. hide keys.
// This is used for both interview response streaming and successor chat streaming, 
// which is why it's in the shared gemini service file.
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

  if (!response.ok) {
    let errorMessage = 'AI stream failed';
    try {
      const payload = await response.json();
      if (payload && typeof payload.message === 'string' && payload.message.trim()) {
        errorMessage = payload.message;
      }
    } catch {
      // add event hanlde later...
    }
    throw new Error(errorMessage);
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  // check reader exists before entering loop. if no reader, just exit generator.
  if (!reader) return;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    yield decoder.decode(value, { stream: true });
  }
}

// Similar streaming function for successor chat, which has same streaming backend but different endpoint and request payload.
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
      // add event handler later...
    }
    throw new Error(errorMessage);
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  // check reader exists before entering loop. if no reader, just exit generator.
  if (!reader) return;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    yield decoder.decode(value, { stream: true });
  }
}
