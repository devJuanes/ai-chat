import crypto from 'node:crypto';
import { config } from '../config.js';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;

function keyBytes() {
  const raw = config.meta.tokenEncryptionKey;
  if (!raw) {
    throw new Error('META_TOKEN_ENCRYPTION_KEY no está configurada');
  }
  // Accept 64-hex (32 bytes) or derive from passphrase
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, 'hex');
  }
  return crypto.createHash('sha256').update(raw).digest();
}

/** Encrypt a Meta access token for DB storage. Returns base64 payload. */
export function encryptToken(plaintext) {
  if (!plaintext) throw new Error('Token vacío');
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, keyBytes(), iv);
  const enc = Buffer.concat([
    cipher.update(String(plaintext), 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

export function decryptToken(payload) {
  if (!payload) throw new Error('Token cifrado vacío');
  const buf = Buffer.from(String(payload), 'base64');
  if (buf.length < IV_LEN + 16) throw new Error('Token cifrado inválido');
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + 16);
  const data = buf.subarray(IV_LEN + 16);
  const decipher = crypto.createDecipheriv(ALGO, keyBytes(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString(
    'utf8'
  );
}

/** Verify X-Hub-Signature-256 from Meta webhooks. */
export function verifyMetaSignature(rawBody, signatureHeader) {
  const secret = config.meta.appSecret;
  if (!secret) return false;
  if (!signatureHeader || typeof signatureHeader !== 'string') return false;
  const expected = signatureHeader.replace(/^sha256=/i, '').trim();
  if (!/^[0-9a-fA-F]{64}$/.test(expected)) return false;
  const hmac = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');
  try {
    return crypto.timingSafeEqual(
      Buffer.from(hmac, 'hex'),
      Buffer.from(expected, 'hex')
    );
  } catch {
    return false;
  }
}

/** Sign a short-lived OAuth state blob (base64url.hmac). */
export function signOAuthState(payload, ttlSec = 600) {
  const body = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + ttlSec,
  };
  const data = Buffer.from(JSON.stringify(body)).toString('base64url');
  const sig = crypto
    .createHmac('sha256', keyBytes())
    .update(data)
    .digest('base64url');
  return `${data}.${sig}`;
}

export function verifyOAuthState(state) {
  if (!state || typeof state !== 'string' || !state.includes('.')) return null;
  const [data, sig] = state.split('.');
  if (!data || !sig) return null;
  const expected = crypto
    .createHmac('sha256', keyBytes())
    .update(data)
    .digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  try {
    if (!crypto.timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const body = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    if (!body?.exp || body.exp < Math.floor(Date.now() / 1000)) return null;
    return body;
  } catch {
    return null;
  }
}
