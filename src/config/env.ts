import { z } from 'zod';

// frontend only need api url. 
const envSchema = z.object({
  VITE_API_URL: z.string().url().default(
    typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8080'
  ),
});

// validate env. use current origin if no url set.
export const env = envSchema.parse({
  VITE_API_URL: import.meta.env.VITE_API_URL,
});
