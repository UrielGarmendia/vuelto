import { handle, HttpError } from '../_lib/http.js';
import { withIol } from '../_lib/iol.js';

/** Markets get_price_history knows; funds (FCI) have no daily bars there. */
export const MARKETS = ['BCBA', 'NYSE', 'NASDAQ', 'AMEX'] as const;
/** Chart ranges, in days back from today. */
export const RANGES = { '1S': 7, '1M': 31, '3M': 92, '1A': 366 } as const;

const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Daily bars for one asset. The dates are worked out here, never taken from the client. */
export function POST(req: Request) {
  return handle(async () => {
    const q = new URL(req.url).searchParams;
    const symbol = q.get('symbol') ?? '';
    const market = MARKETS.find((m) => m === q.get('market'));
    const range = q.get('range') ?? '';
    if (!/^[A-Z0-9.]{1,15}$/.test(symbol) || !market || !(range in RANGES))
      throw new HttpError(400, 'Pedido inválido');
    const now = Date.now();
    const days = RANGES[range as keyof typeof RANGES];
    return withIol(req, 'get_price_history', {
      symbol,
      market,
      from_date: isoDay(now - days * 86_400_000),
      to_date: isoDay(now),
    });
  });
}
