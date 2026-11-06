/**
 * Sign-in with Google Identity Services (token model), only for the Drive appDataFolder.
 * The access token lives about an hour; it is kept with its expiry so a reopened app can
 * still sync, and asking for a new one needs a tap ("Reconectar con Google").
 */

export const CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ?? '';
export const PRODUCTION_ORIGIN = 'https://vuelto-gestor-gastos.vercel.app';
const SCOPES = 'https://www.googleapis.com/auth/drive.appdata openid email profile';
const GIS_SRC = 'https://accounts.google.com/gsi/client';

export type Availability = 'ready' | 'no-client' | 'wrong-origin';

/** Login is offered only in production and on localhost; Vercel previews are not registered. */
export function availability(origin = location.origin, clientId = CLIENT_ID): Availability {
  if (!clientId) return 'no-client';
  const local = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  return local || origin === PRODUCTION_ORIGIN ? 'ready' : 'wrong-origin';
}

export interface Token {
  value: string;
  expiresAt: number;
}

export interface Profile {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
}

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
}
interface TokenClient {
  requestAccessToken(overrides?: { prompt?: string; login_hint?: string }): void;
}
interface Gis {
  accounts: {
    oauth2: {
      initTokenClient(config: {
        client_id: string;
        scope: string;
        callback: (r: TokenResponse) => void;
        error_callback?: (e: { type: string }) => void;
      }): TokenClient;
      revoke(token: string, done?: () => void): void;
    };
  };
}

let gis: Promise<Gis> | undefined;
function loadGis(): Promise<Gis> {
  gis ??= new Promise((resolve, reject) => {
    const script = Object.assign(document.createElement('script'), { src: GIS_SRC, async: true });
    script.onload = () => resolve((window as unknown as { google: Gis }).google);
    script.onerror = () => {
      gis = undefined;
      reject(new Error('No se pudo cargar Google'));
    };
    document.head.append(script);
  });
  return gis;
}

/** Opens Google's consent (or account chooser) and resolves with a fresh access token. */
export async function requestToken(loginHint?: string): Promise<Token> {
  const google = await loadGis();
  return new Promise((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: (r) =>
        r.access_token
          ? resolve({
              value: r.access_token,
              // A minute of margin so a sync never starts with a token about to expire.
              expiresAt: Date.now() + ((r.expires_in ?? 3600) - 60) * 1000,
            })
          : reject(new Error(r.error ?? 'Sin permiso')),
      error_callback: (e) => reject(new Error(e.type)),
    });
    // Empty prompt: no consent screen again once the user agreed.
    client.requestAccessToken({ prompt: loginHint ? '' : 'select_account', login_hint: loginHint });
  });
}

export async function fetchProfile(token: string): Promise<Profile> {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`userinfo ${res.status}`);
  const p = (await res.json()) as Profile;
  return { sub: p.sub, email: p.email, name: p.name, picture: p.picture };
}

export async function revoke(token: string): Promise<void> {
  const google = await loadGis().catch(() => undefined);
  google?.accounts.oauth2.revoke(token);
}
