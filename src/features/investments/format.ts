import type { Currency } from '../../lib/money';
import { formatMoney } from '../../lib/money';
import type { Position } from '../external/provider';

const ago = new Intl.RelativeTimeFormat('es-AR', { numeric: 'auto' });

/** "hace 5 minutos", "ayer"… for "Actualizado …". */
export function since(ms: number) {
  const min = Math.round((Date.now() - ms) / 60000);
  if (min < 1) return 'recién';
  if (min < 60) return ago.format(-min, 'minute');
  const h = Math.round(min / 60);
  return h < 48 ? ago.format(-h, 'hour') : ago.format(-Math.round(h / 24), 'day');
}

/** "+1,50 %" / "−0,25 %". */
export const pct = (p: number) =>
  `${p > 0 ? '+' : p < 0 ? '−' : ''}${Math.abs(p).toFixed(2).replace('.', ',')} %`;

/** "+$ 1.000" / "−$ 1.000". */
export const signedMoney = (cents: number, currency: Currency = 'ARS') =>
  `${cents > 0 ? '+' : cents < 0 ? '−' : ''}${formatMoney(Math.abs(cents), currency)}`;

/** Where an asset's detail lives; funds without a market still get a page. */
export const assetPath = (p: Pick<Position, 'market' | 'symbol'>) =>
  `/inversiones/${encodeURIComponent(p.market || 'otro')}/${encodeURIComponent(p.symbol)}`;
