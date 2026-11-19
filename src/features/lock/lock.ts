import { fetchProfile, requestToken } from '../sync/google';

/**
 * Screen lock with the device's own unlock (fingerprint, face or PIN) through WebAuthn.
 * It hides the app until the person proves it is them; it does not encrypt the data, which
 * stays in IndexedDB as before. Google is always the way back in if the device's unlock
 * fails (new phone, fingerprints erased), so nobody is ever locked out.
 */

const KEY = 'vuelto-lock';

export interface LockSettings {
  /** The platform credential's id, base64url. */
  credentialId: string;
  /** Minutes in the background before asking again. */
  minutes: number;
  /** The Google account that can always unlock. */
  googleSub: string;
  googleEmail: string;
}

export const LOCK_MINUTES = [1, 5, 15] as const;

export function readLock(): LockSettings | undefined {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as LockSettings) : undefined;
  } catch {
    return undefined;
  }
}

export const writeLock = (s: LockSettings | undefined) =>
  s ? localStorage.setItem(KEY, JSON.stringify(s)) : localStorage.removeItem(KEY);

/** Only offered where the device has its own unlock (Touch ID, Windows Hello, Android). */
export async function lockAvailable(): Promise<boolean> {
  try {
    return (
      typeof PublicKeyCredential !== 'undefined' &&
      (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable())
    );
  } catch {
    return false;
  }
}

const random = (n: number) => crypto.getRandomValues(new Uint8Array(n));
const toB64 = (b: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(b)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
const fromB64 = (s: string) =>
  Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

/** Registers the device's unlock for this app and turns the lock on. */
export async function enableLock(
  minutes: number,
  google: { sub: string; email: string },
): Promise<void> {
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge: random(32),
      rp: { name: 'Vuelto' },
      user: { id: random(16), name: google.email, displayName: 'Vuelto' },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'discouraged',
      },
      timeout: 60_000,
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error('El dispositivo no registró el bloqueo');
  writeLock({
    credentialId: toB64(cred.rawId),
    minutes,
    googleSub: google.sub,
    googleEmail: google.email,
  });
}

/** Asks the device to verify the person. Throws when it cannot (cancelled or credential gone). */
export async function unlockWithDevice(lock: LockSettings): Promise<void> {
  const ok = await navigator.credentials.get({
    publicKey: {
      challenge: random(32),
      allowCredentials: [{ type: 'public-key', id: fromB64(lock.credentialId) }],
      userVerification: 'required',
      timeout: 60_000,
    },
  });
  if (!ok) throw new Error('Sin verificación');
}

export class WrongAccountError extends Error {}

/** The way back in: Google must confirm the same account that set the lock. */
export async function unlockWithGoogle(lock: LockSettings): Promise<void> {
  const token = await requestToken(lock.googleEmail);
  const profile = await fetchProfile(token.value);
  if (profile.sub !== lock.googleSub)
    throw new WrongAccountError(`Entrá con ${lock.googleEmail}, la cuenta de este bloqueo.`);
}
