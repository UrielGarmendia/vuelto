import { handle } from '../_lib/http';
import { withIol } from '../_lib/iol';

export function POST(req: Request) {
  return handle(() => withIol(req, 'get_balance'));
}
