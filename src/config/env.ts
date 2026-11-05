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
  MONGODB_URI: z.string().default('mongodb://127.0.0.1:27017/doctor_videocall_db'),
  CORS_ORIGIN: z.string().default('*'),
  JWT_SECRET: z.string().min(8, 'JWT_SECRET must be at least 8 characters long'),
  MAIN_BACKEND_URL: z.string().url().default('http://localhost:5000'),
  SERVICE_API_KEY: z.string().default('telemedicine_subservice_internal_secure_key_12345'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly']).default('info'),

  // ZEGOCLOUD Video Calling Credentials
  ZEGO_APP_ID: z
    .string()
    .default('2065487693')
    .transform((val) => parseInt(val, 10)),
  ZEGO_APP_SIGN: z.string().default('65a9d29ab9d889699b95763a8e3da5fa9b9f2e1ba5de5430108411311e50b8d4'),
  ZEGO_CALLBACK_SECRET: z.string().default('65a9d29ab9d889699b95763a8e3da5fa'),

  // COMETCHAT In-App Messaging Credentials
  COMETCHAT_APP_ID: z.string().default('1678929173ca5fc8c'),
  COMETCHAT_AUTH_KEY: z.string().default('7777d9d1fbc2f1df8f728714b1919f9ce393a24b'),
  COMETCHAT_REST_API_KEY: z.string().default('9a53fbf903bd310aeb2faa9bb1cf8c5d08aecee4'),
  COMETCHAT_REGION: z.string().default('in'),

  // Fallback STUN Servers
  STUN_SERVERS: z.string().default('stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302'),
  TURN_SERVER_URL: z.string().optional(),
  TURN_SERVER_USERNAME: z.string().optional(),
  TURN_SERVER_CREDENTIAL: z.string().optional(),

  // Optional Self Keep-Alive Ping URL (for Render/Fly/Railway to prevent sleeping)
  KEEP_ALIVE_URL: z.string().optional(),
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
