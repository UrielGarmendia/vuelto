import { handle, HttpError } from '../_lib/http.js';
import { withIol } from '../_lib/iol.js';

const COUNTRIES = ['ARG', 'USA'] as const;
const MAX_DAYS = 3 * 366;

/** IOL's own daily record of the holdings, to fill the net worth curve before Vuelto's. */
export function POST(req: Request) {
  return handle(async () => {
    const q = new URL(req.url).searchParams;
    const country = COUNTRIES.find((c) => c === q.get('country'));
    const days = Number(q.get('days'));
    if (!country || !Number.isInteger(days) || days < 1 || days > MAX_DAYS)
      throw new HttpError(400, 'Pedido inválido');
    const now = Date.now();
    const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);
    return withIol(req, 'get_aum_evolution', {
      country,
      from_date: day(now - days * 86_400_000),
      to_date: day(now),
    });
  });
}
