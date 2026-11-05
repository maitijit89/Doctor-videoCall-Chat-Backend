import { test } from 'node:test';
import assert from 'node:assert';
import { generateToken04, verifyZegoCallbackSignature } from '../src/services/zegoServerAssistant.js';

test('ZEGOCLOUD Token04 cryptographic generation', () => {
  const appId = 2065487693;
  const userId = 'doc_test_101';
  const secret = '65a9d29ab9d889699b95763a8e3da5fa'; // 32 chars
  const effectiveSeconds = 3600;
  const payload = JSON.stringify({ room_id: 'test_room', privilege: { 1: 1, 2: 1 } });

  const token = generateToken04(appId, userId, secret, effectiveSeconds, payload);

  assert.ok(token.startsWith('04'), 'Token must be prefixed with 04');
  assert.ok(token.length > 50, 'Token length must be non-trivial');
});

test('ZEGOCLOUD Webhook signature verification', () => {
  const secret = '65a9d29ab9d889699b95763a8e3da5fa';
  const nonce = '123456';
  const timestamp = '1779123000';

  // Calculate signature
  const crypto = require('crypto');
  const arr = [secret, nonce, timestamp].sort();
  const validSig = crypto.createHash('sha256').update(arr.join('')).digest('hex');

  const isValid = verifyZegoCallbackSignature(nonce, timestamp, validSig, secret);
  assert.strictEqual(isValid, true, 'Valid signature should verify true');

  const isInvalid = verifyZegoCallbackSignature(nonce, timestamp, 'wrong_signature', secret);
  assert.strictEqual(isInvalid, false, 'Invalid signature should verify false');
});
