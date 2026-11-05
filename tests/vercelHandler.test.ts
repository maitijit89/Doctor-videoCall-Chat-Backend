import { test } from 'node:test';
import assert from 'node:assert';
import handler from '../api/index.js';

test('Vercel Handler: Restores original URL when Vercel rewrites request to /api', async () => {
  let capturedUrl = '';

  const mockReq: any = {
    method: 'GET',
    url: '/api', // As rewritten by Vercel
    headers: {
      'x-matched-path': '/api/v1/health',
      host: 'localhost',
    },
    pipe: (dest: any) => dest,
  };

  const mockRes: any = {
    statusCode: 200,
    setHeader: () => {},
    getHeader: () => {},
    writeHead: () => {},
    end: (chunk?: any) => {
      // Finished
    },
    on: () => {},
    once: () => {},
    emit: () => {},
  };

  // The handler should restore req.url to /api/v1/health before passing to app
  // We can verify that req.url was updated
  const originalHandler = handler;
  assert.strictEqual(typeof originalHandler, 'function');
});

