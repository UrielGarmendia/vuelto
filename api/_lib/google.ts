import { HttpError } from './http.js';

interface TokenInfo {
  sub?: string;
  azp?: string;
  aud?: string;
  exp?: string;
  error_description?: string;
}

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
  const token = /^Bearer (.+)$/.exec(req.headers.get('authorization') ?? '')?.[1];
  if (!token) throw new HttpError(401, 'Falta la sesión de Google');
  const res = await fetcher(
    `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(token)}`,
  );
  const info = (await res.json().catch(() => ({}))) as TokenInfo;
  if (!res.ok || !info.sub) throw new HttpError(401, 'Sesión de Google inválida');
  if (info.azp !== clientId && info.aud !== clientId) {
    // Client ids are public; logging both makes a misconfigured deploy obvious in the logs.
    console.error(`Google token issued to ${info.azp ?? info.aud}, expected ${clientId}`);
    throw new HttpError(401, 'La sesión de Google es de otra app');
  }
  if (!info.exp || Number(info.exp) * 1000 < now)
    throw new HttpError(401, 'Sesión de Google vencida');
  return info.sub;
}
