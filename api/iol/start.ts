import { googleUser } from '../_lib/google.js';
import { env, handle, HttpError, json } from '../_lib/http.js';
import { AUTHORIZE_URL, redirectUri } from '../_lib/iol.js';
import { challenge, verifier } from '../_lib/pkce.js';
import { seal } from '../_lib/seal.js';

/** Step 1: returns IOL's authorize URL. The PKCE verifier and the Google user travel sealed in
 * `state`, so the callback can trust them without the server storing anything. */
export function POST(req: Request) {
  return handle(async () => {
    const sub = await googleUser(req, env('GOOGLE_CLIENT_ID'));
    const v = verifier();
    const state = await seal({ v, sub, exp: Date.now() + 10 * 60 * 1000 }, env('IOL_TOKEN_KEY'));
    const url = new URL(AUTHORIZE_URL);
    url.search = new URLSearchParams({
      response_type: 'code',
      client_id: env('IOL_CLIENT_ID'),
      redirect_uri: redirectUri(),
      code_challenge: await challenge(v),
      code_challenge_method: 'S256',
      state,
    }).toString();
    return json({ url: url.toString() });
  });
}

export function GET() {
  return handle(async () => {
    throw new HttpError(405, 'Usá POST');
  });
}
