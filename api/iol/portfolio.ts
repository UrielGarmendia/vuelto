import { handle } from '../_lib/http.js';
import { withIol } from '../_lib/iol.js';

/** get_portfolio's two markets; anything else falls back to Argentina. */
export const COUNTRIES = ['argentina', 'estados_Unidos'] as const;

export function POST(req: Request) {
  const asked = new URL(req.url).searchParams.get('country');
  const country = COUNTRIES.find((c) => c === asked) ?? 'argentina';
  return handle(() => withIol(req, 'get_portfolio', { country }));
}
