import { z } from 'zod';

const envSchema = z.object({
  VITE_API_URL: z.string().url().refine((url) => {
    if (import.meta.env.PROD && !url.startsWith('https://')) {
      return false;
    }
    return true;
  }, { message: "Production API URL must use HTTPS" }),
  VITE_GEMINI_API_KEY: z.string().min(1),
});

// /caveman: validate env. force https in prod.
export const env = envSchema.parse({
  VITE_API_URL: import.meta.env.VITE_API_URL,
  VITE_GEMINI_API_KEY: import.meta.env.VITE_GEMINI_API_KEY,
});
