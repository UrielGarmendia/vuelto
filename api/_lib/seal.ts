/**
 * Sealed blobs: AES-256-GCM with IOL_TOKEN_KEY, so the client can hold IOL's tokens without
 * being able to read or alter them, and the server keeps nothing. Every blob carries its
 * own expiry.
 */

const enc = new TextEncoder();
const dec = new TextDecoder();

const b64url = (bytes: Uint8Array) =>
  Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = (s: string) =>
  new Uint8Array(Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64'));

export class SealError extends Error {}

async function key(secret: string) {
  const raw = Buffer.from(secret, 'base64');
  if (raw.length !== 32) throw new SealError('IOL_TOKEN_KEY must be 32 bytes in base64');
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function seal<T extends { exp: number }>(payload: T, secret: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    await key(secret),
    enc.encode(JSON.stringify(payload)),
  );
  return `${b64url(iv)}.${b64url(new Uint8Array(data))}`;
}

/** Opens a blob; tampered, foreign or expired blobs are rejected. */
export async function unseal<T extends { exp: number }>(
  blob: string,
  secret: string,
  now = Date.now(),
): Promise<T> {
  const [iv, data] = typeof blob === 'string' ? blob.split('.') : [];
  if (!iv || !data) throw new SealError('Malformed blob');
  let payload: T;
  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromB64url(iv) },
      await key(secret),
      fromB64url(data),
    );
    payload = JSON.parse(dec.decode(plain)) as T;
  } catch {
    throw new SealError('Blob does not open with this key');
  }
  if (typeof payload.exp !== 'number' || payload.exp < now) throw new SealError('Blob expired');
  return payload;
}
