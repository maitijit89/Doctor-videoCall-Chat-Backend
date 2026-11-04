import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables from .env file
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z
    .string()
    .default('5001')
    .transform((val) => parseInt(val, 10)),
  CORS_ORIGIN: z.string().default('*'),
  JWT_SECRET: z.string().min(8, 'JWT_SECRET must be at least 8 characters long'),
  MAIN_BACKEND_URL: z.string().url().default('http://localhost:5000'),
  SERVICE_API_KEY: z.string().default('telemedicine_subservice_internal_secure_key_12345'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly']).default('info'),
  STUN_SERVERS: z.string().default('stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302'),
  TURN_SERVER_URL: z.string().optional(),
  TURN_SERVER_USERNAME: z.string().optional(),
  TURN_SERVER_CREDENTIAL: z.string().optional(),
});

const parseEnv = () => {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('❌ Invalid environment variables:', JSON.stringify(result.error.format(), null, 2));
    process.exit(1);
  }

  return result.data;
};

export const env = parseEnv();
export type Env = z.infer<typeof envSchema>;
