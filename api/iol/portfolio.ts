import { handle } from '../_lib/http.js';
import { withIol } from '../_lib/iol.js';

export function POST(req: Request) {
  return handle(() => withIol(req, 'get_portfolio', { country: 'argentina' }));
}
