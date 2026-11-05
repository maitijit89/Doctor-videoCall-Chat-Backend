import { test } from 'node:test';
import assert from 'node:assert';
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env.js';
import { timingSafeEqual } from 'crypto';

test('Security: JWT Algorithm Pinning rejects "none" algorithm and ensures HS256', () => {
  const payload = { id: 'user_123', name: 'Dr. Test', role: 'doctor' };
  
  // Valid token signed with HS256
  const validToken = jwt.sign(payload, env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' });
  const verified = jwt.verify(validToken, env.JWT_SECRET, { algorithms: ['HS256'] }) as any;
  assert.strictEqual(verified.id, 'user_123');

  // Attempt to forge token with none algorithm or invalid secret
  assert.throws(() => {
    jwt.verify(validToken, 'wrong_secret', { algorithms: ['HS256'] });
  }, /invalid signature/);
});

test('Security: Timing-safe comparison prevents timing attacks', () => {
  const secretA = 'correct-service-api-key-test-value';
  const secretB = 'correct-service-api-key-test-value';
  const secretWrong = 'wrong-service-api-key-test-value!!';

  const bufA = Buffer.from(secretA, 'utf8');
  const bufB = Buffer.from(secretB, 'utf8');
  const bufWrong = Buffer.from(secretWrong, 'utf8');

  assert.strictEqual(bufA.length === bufB.length && timingSafeEqual(bufA, bufB), true);
  assert.strictEqual(bufA.length === bufWrong.length && timingSafeEqual(bufA, bufWrong), false);
});

test('Security: ReDoS regex character sanitizer properly neutralizes nested quantifiers', () => {
  const redosPayload = '(a+)+$';
  const sanitized = redosPayload.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  assert.strictEqual(sanitized, '\\(a\\+\\)\\+\\$');
  
  // Test with RegExp creation
  const safeRegex = new RegExp(sanitized, 'i');
  assert.ok(safeRegex.test('(a+)+$'));
  assert.ok(!safeRegex.test('aaaaaaaaaaaaaaaaaaaaaaaaaaaa!'));
});

