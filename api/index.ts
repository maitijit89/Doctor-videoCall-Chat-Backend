import { createApp } from '../src/app.js';
import { connectDatabase } from '../src/config/database.js';

// Instantiate Express App
const app = createApp();

/**
 * Vercel Serverless Function Handler
 * Wraps Express application and ensures database connection is established / reused.
 */
export default async function handler(req: any, res: any) {
  try {
    await connectDatabase();
  } catch (err: any) {
    console.error('Failed to connect to database in Vercel function:', err);
  }
  return app(req, res);
}
