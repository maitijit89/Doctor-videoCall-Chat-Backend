import { createCipheriv, createHash } from 'crypto';

export enum ZegoErrorCode {
  success = 0,
  appIDInvalid = 1,
  userIDInvalid = 3,
  secretInvalid = 5,
  effectiveTimeInSecondsInvalid = 6,
}

export interface ZegoPrivilegePayload {
  room_id?: string;
  privilege?: {
    1?: number; // 1: loginRoom (1=enable, 0=disable)
    2?: number; // 2: publishStream (1=enable, 0=disable)
  };
  stream_id_list?: string[] | null;
}

function rndNum(a: number, b: number): number {
  return Math.ceil((a + (b - a)) * Math.random());
}

function makeNonce(): number {
  return rndNum(-2147483648, 2147483647);
}

function makeRandomIv(): string {
  const str = '0123456789abcdefghijklmnopqrstuvwxyz';
  const result: string[] = [];
  for (let i = 0; i < 16; i++) {
    const r = Math.floor(Math.random() * str.length);
    result.push(str.charAt(r));
  }
  return result.join('');
}

function getAlgorithm(keyBase64: string): string {
  const key = Buffer.from(keyBase64);
  switch (key.length) {
    case 16:
      return 'aes-128-cbc';
    case 24:
      return 'aes-192-cbc';
    case 32:
      return 'aes-256-cbc';
  }
  throw new Error('Invalid key length: ' + key.length);
}

function aesEncrypt(plainText: string, key: string, iv: string): ArrayBuffer {
  const cipher = createCipheriv(getAlgorithm(key), key, iv);
  cipher.setAutoPadding(true);
  const encrypted = cipher.update(plainText);
  const final = cipher.final();
  const out = Buffer.concat([encrypted, final]);

  return Uint8Array.from(out).buffer;
}

/**
 * Generate ZEGOCLOUD Token04
 */
export function generateToken04(
  appId: number,
  userId: string,
  secret: string,
  effectiveTimeInSeconds: number,
  payload?: string
): string {
  if (!appId || typeof appId !== 'number') {
    throw new Error('appID invalid: must be a number');
  }

  if (!userId || typeof userId !== 'string') {
    throw new Error('userId invalid: must be a non-empty string');
  }

  // Ensure secret is 32 bytes (if 64-char hex, take first 32 chars)
  const formattedSecret = secret.length > 32 ? secret.substring(0, 32) : secret;

  if (formattedSecret.length !== 32) {
    throw new Error(`secret must be a 32 byte string, received length: ${formattedSecret.length}`);
  }

  if (!effectiveTimeInSeconds || typeof effectiveTimeInSeconds !== 'number') {
    throw new Error('effectiveTimeInSeconds invalid: must be a positive number');
  }

  const createTime = Math.floor(new Date().getTime() / 1000);
  const tokenInfo = {
    app_id: appId,
    user_id: userId,
    nonce: makeNonce(),
    ctime: createTime,
    expire: createTime + effectiveTimeInSeconds,
    payload: payload || '',
  };

  const plainText = JSON.stringify(tokenInfo);
  const iv: string = makeRandomIv();

  const encryptBuf = aesEncrypt(plainText, formattedSecret, iv);

  const [b1, b2, b3] = [new Uint8Array(8), new Uint8Array(2), new Uint8Array(2)];
  new DataView(b1.buffer).setBigInt64(0, BigInt(tokenInfo.expire), false);
  new DataView(b2.buffer).setUint16(0, iv.length, false);
  new DataView(b3.buffer).setUint16(0, encryptBuf.byteLength, false);

  const buf = Buffer.concat([
    Buffer.from(b1),
    Buffer.from(b2),
    Buffer.from(iv),
    Buffer.from(b3),
    Buffer.from(encryptBuf),
  ]);

  const dv = new DataView(Uint8Array.from(buf).buffer);
  return '04' + Buffer.from(dv.buffer).toString('base64');
}

/**
 * Verifies ZEGOCLOUD Webhook Callback Signature
 * Formula: sha256(secret + nonce + timestamp)
 */
export function verifyZegoCallbackSignature(
  nonce: string,
  timestamp: string,
  signature: string,
  callbackSecret: string
): boolean {
  if (!nonce || !timestamp || !signature || !callbackSecret) return false;

  const arr = [callbackSecret, nonce, timestamp].sort();
  const concatenated = arr.join('');
  const calculatedSig = createHash('sha256').update(concatenated).digest('hex');

  return calculatedSig.toLowerCase() === signature.toLowerCase();
}
