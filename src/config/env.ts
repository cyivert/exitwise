import { z } from 'zod';

// frontend only need api url. 
const envSchema = z.object({
  VITE_API_URL: z.string().default(''),
});

export const env = envSchema.parse({
  VITE_API_URL: import.meta.env.VITE_API_URL || '',
});
