import { env } from '../config/env';
import { useAuthStore } from '../store/authStore';

export async function* streamInterviewResponse(sessionId: string, userResponse: string) {
  const { token } = useAuthStore.getState();

  // Make sure VITE_API_URL is pointing to your Bun server (e.g., http://localhost:8080)
  const apiUrl = env.VITE_API_URL || ''; 

  const response = await fetch(`${apiUrl}/api/interview/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ sessionId, userResponse }),
  });

  // 🔥 THIS IS THE FIX TO SEE THE REAL ERROR 🔥
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Backend crashed! Status: ${response.status}. Message: ${errorText}`);
    throw new Error(`AI stream failed: ${response.status} - ${errorText}`);
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