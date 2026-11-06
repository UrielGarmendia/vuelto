import { env, HttpError, json } from './http.js';
import { googleUser } from './google.js';
import { callTool, McpAuthError, type AllowedTool } from './mcp.js';
import { seal, SealError, unseal } from './seal.js';

export const AUTHORIZE_URL = 'https://mcp.invertironline.com/authorize';
const TOKEN_URL = 'https://mcp.invertironline.com/token';
/** A connection lasts this long without use before asking to reconnect. */
export const BLOB_TTL = 90 * 24 * 60 * 60 * 1000;

/** What the client holds: IOL's tokens, sealed, bound to one Google user. */
export interface IolBlob {
  access: string;
  refresh?: string;
  accessExp: number;
  sub: string;
  exp: number;
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
}

export function redirectUri() {
  return process.env.IOL_REDIRECT_URI ?? 'https://vuelto-gestor-gastos.vercel.app/api/iol/callback';
}

async function token(params: Record<string, string>, fetcher: typeof fetch) {
  const res = await fetcher(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: env('IOL_CLIENT_ID'), ...params }),
  });
  const body = (await res.json().catch(() => ({}))) as TokenResponse;
  if (!res.ok || !body.access_token) throw new HttpError(401, 'IOL no entregó el acceso');
  return body;
}

export async function blobFromTokens(t: TokenResponse, sub: string, prev?: IolBlob) {
  const now = Date.now();
  const blob: IolBlob = {
    access: t.access_token!,
    // IOL may rotate the refresh token; keep the old one only if it did not send a new one.
    refresh: t.refresh_token ?? prev?.refresh,
    accessExp: now + ((t.expires_in ?? 3600) - 60) * 1000,
    sub,
    exp: now + BLOB_TTL,
  };
  return { blob, sealed: await seal(blob, env('IOL_TOKEN_KEY')) };
}

export function exchangeCode(code: string, codeVerifier: string, fetcher: typeof fetch = fetch) {
  return token(
    {
      grant_type: 'authorization_code',
      code,
      code_verifier: codeVerifier,
      redirect_uri: redirectUri(),
    },
    fetcher,
  );
}

/**
 * The read endpoints: check the Google user, open the blob (it must belong to that same
 * user), refresh IOL's token if needed and call one allowed tool. When the tokens changed,
 * the new sealed blob goes back to the client.
 */
export async function withIol(
  req: Request,
  tool: AllowedTool,
  args: Record<string, unknown> = {},
  fetcher: typeof fetch = fetch,
): Promise<Response> {
  if (req.method !== 'POST') throw new HttpError(405, 'Usá POST');
  const sub = await googleUser(req, env('GOOGLE_CLIENT_ID'), fetcher);
  const { blob: sealed } = (await req.json().catch(() => ({}))) as { blob?: string };
  let blob: IolBlob;
  try {
    blob = await unseal<IolBlob>(sealed ?? '', env('IOL_TOKEN_KEY'));
  } catch (err) {
    if (err instanceof SealError) throw new HttpError(401, 'Reconectá IOL');
    throw err;
  }
  if (blob.sub !== sub)
    throw new HttpError(403, 'Esta conexión de IOL es de otra cuenta de Google');

  let next: string | undefined;
  const refresh = async () => {
    if (!blob.refresh) throw new HttpError(401, 'Reconectá IOL');
    const r = await blobFromTokens(
      await token({ grant_type: 'refresh_token', refresh_token: blob.refresh }, fetcher),
      sub,
      blob,
    );
    blob = r.blob;
    next = r.sealed;
  };
  if (blob.accessExp < Date.now()) await refresh();
  let data: unknown;
  try {
    data = await callTool(blob.access, tool, args, fetcher);
  } catch (err) {
    if (!(err instanceof McpAuthError)) throw err;
    await refresh();
    data = await callTool(blob.access, tool, args, fetcher);
  }
  return json({ data, blob: next });
}
