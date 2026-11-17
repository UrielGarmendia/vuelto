import { HttpError } from './http.js';

interface TokenInfo {
  sub?: string;
  azp?: string;
  aud?: string;
  exp?: string;
  email?: string;
  email_verified?: string;
  error_description?: string;
}

/** Enough of an id to tell two apart in the logs without printing it whole. */
export const mask = (s = '') => `${s.slice(0, 6)}…${s.slice(-6)}`;

/**
 * Who is calling: the Google access token in Authorization is checked with Google itself
 * (tokeninfo), which only answers for genuine, unexpired tokens. It must have been issued to
 * our client id. Returns the user's stable Google id (`sub`).
 */
export async function googleUser(
  req: Request,
  clientId: string,
  fetcher: typeof fetch = fetch,
  now = Date.now(),
): Promise<string> {
  return (await googleIdentity(req, clientId, fetcher, now)).sub;
}

/** Like `googleUser`, plus the verified email (lowercase) when the token carries one. */
export async function googleIdentity(
  req: Request,
  clientId: string,
  fetcher: typeof fetch = fetch,
  now = Date.now(),
): Promise<{ sub: string; email?: string }> {
  const token = /^Bearer (.+)$/.exec(req.headers.get('authorization') ?? '')?.[1];
  if (!token) throw new HttpError(401, 'Falta la sesión de Google');
  const res = await fetcher(
    `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(token)}`,
  );
  const info = (await res.json().catch(() => ({}))) as TokenInfo;
  if (!res.ok || !info.sub) throw new HttpError(401, 'Sesión de Google inválida');
  if (info.azp !== clientId && info.aud !== clientId) {
    // Client ids are public; logging both makes a misconfigured deploy obvious in the logs.
    console.error(
      `Google token issued to ${mask(info.azp ?? info.aud)}, expected ${mask(clientId)}`,
    );
    throw new HttpError(401, 'La sesión de Google es de otra app');
  }
  if (!info.exp || Number(info.exp) * 1000 < now)
    throw new HttpError(401, 'Sesión de Google vencida');
  const email = info.email_verified === 'true' ? info.email?.toLowerCase() : undefined;
  return { sub: info.sub, email };
}
