import { test } from 'node:test';
import assert from 'node:assert';
import http from 'http';
import { createApp } from '../src/app.js';

test('Alive Ping: Root endpoints /ping, /alive, and /healthz respond with 200', async () => {
  const app = createApp();
  const server = http.createServer(app);

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;

  const fetchEndpoint = async (path: string): Promise<{ status: number; text: string }> => {
    return new Promise((resolve, reject) => {
      http.get(`http://localhost:${port}${path}`, (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => resolve({ status: res.statusCode || 500, text: data }));
        res.on('error', reject);
      });
    });
  };

  try {
    // 1. Top-level /ping
    const pingRes = await fetchEndpoint('/ping');
    assert.strictEqual(pingRes.status, 200);
    const parsedPing = JSON.parse(pingRes.text);
    assert.strictEqual(parsedPing.status, 'alive');
    assert.strictEqual(parsedPing.message, 'pong');

    // 2. Top-level /alive
    const aliveRes = await fetchEndpoint('/alive');
    assert.strictEqual(aliveRes.status, 200);
    assert.strictEqual(aliveRes.text, 'OK');

    // 3. /healthz (Kubernetes / Docker)
    const healthzRes = await fetchEndpoint('/healthz');
    assert.strictEqual(healthzRes.status, 200);
    assert.strictEqual(healthzRes.text, 'OK');

    // 4. API v1 scoped /api/v1/ping
    const apiPingRes = await fetchEndpoint('/api/v1/ping');
    assert.strictEqual(apiPingRes.status, 200);
    const parsedApiPing = JSON.parse(apiPingRes.text);
    assert.strictEqual(parsedApiPing.status, 'alive');
  } finally {
    server.close();
  }
});
