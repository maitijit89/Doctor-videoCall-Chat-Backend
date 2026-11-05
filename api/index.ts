import { createApp } from '../src/app.js';
import { connectDatabase } from '../src/config/database.js';

// Instantiate Express App
const app = createApp();

/**
 * Vercel Serverless Function Handler
 * Wraps Express application and ensures database connection is established / reused.
 * Restores original request URL if Vercel internal rewrite changed it to the function destination.
 */
export default async function handler(req: any, res: any) {
  // If Vercel internal rewrite altered the path, restore the client's original requested URL
  const originalPath =
    (req.headers['x-forwarded-url'] as string) ||
    (req.headers['x-matched-path'] as string) ||
    (req.headers['x-original-url'] as string);

  if (originalPath && req.url !== originalPath) {
    const queryIndex = req.url.indexOf('?');
    const queryString = queryIndex !== -1 ? req.url.substring(queryIndex) : '';
    req.url = originalPath.split('?')[0] + queryString;
  }

  try {
    await connectDatabase();
  } catch (err: any) {
    console.error('Failed to connect to database in Vercel function:', err);
  }

  return app(req, res);
}

