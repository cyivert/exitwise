import { z } from 'zod';

// /caveman: frontend only need api url. 
const envSchema = z.object({
  VITE_API_URL: z.string().url().default('http://localhost:8080'),
});

// /caveman: validate frontend env.
export const env = envSchema.parse({
  VITE_API_URL: import.meta.env.VITE_API_URL,
});
