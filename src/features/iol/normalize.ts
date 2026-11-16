import type { AssetCategory, CashAccount, Position, Snapshot } from '../external/provider';

/**
 * IOL's MCP answers (get_balance and get_portfolio) turned into the provider-neutral snapshot.
 * Anything unexpected is skipped instead of trusted.
 */

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const str = (v: unknown) => (typeof v === 'string' ? v : '');
const cents = (v: unknown) => Math.round((num(v) ?? 0) * 100);
const obj = (v: unknown): Record<string, unknown> =>
  typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {};

/** The tool result may arrive bare or inside `data`. */
function unwrap(raw: unknown, key: string): Record<string, unknown> {
  const o = obj(raw);
  return key in o || !('data' in o) ? o : obj(o.data);
}

const currencyOf = (v: unknown): 'ARS' | 'USD' | undefined => {
  const s = str(v).toUpperCase();
  return s === 'ARS' || s === 'USD' ? s : undefined;
};

/** Cash accounts in get_balance, in display order. */
const CASH_ACCOUNTS = [
  { id: 'arg_ars', label: 'Pesos', currency: 'ARS' },
  { id: 'arg_usd', label: 'Dólares (Argentina)', currency: 'USD' },
  { id: 'eeuu_usd', label: 'Dólares (EE.UU.)', currency: 'USD' },
] as const;

/**
 * Cash per account. Each one has `totals`, `available` and `committed` by settlement term
 * (t0–t3); t0 is what is settled today. `totals` = available + committed, cash only.
 */
export function normalizeBalance(raw: unknown): Pick<Snapshot, 'cash' | 'accounts'> {
  const data = unwrap(raw, 'arg_ars');
  const cash = { ARS: 0, USD: 0 };
  const accounts: CashAccount[] = [];
  for (const { id, label, currency } of CASH_ACCOUNTS) {
    if (!(id in data)) continue;
    const a = obj(data[id]);
    const totalCents = cents(obj(a.totals).t0);
    accounts.push({
      id,
      label,
      currency,
      totalCents,
      availableCents: cents(obj(a.available).t0),
    });
    cash[currency] += totalCents;
  }
  return { cash, accounts };
}

/** IOL's asset type ("CEDEARS", "Fondo Común de Inversión", …) as a readable class. */
export function assetCategory(type: string): AssetCategory {
  const t = type.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  if (t.includes('cedear')) return 'CEDEARs';
  if (t.includes('accion')) return 'Acciones';
  if (t.includes('fondo') || t.includes('fci')) return 'FCI';
  if (t.includes('obligacion') || t === 'ons' || t === 'on') return 'ONs';
  if (t.includes('caucion')) return 'Cauciones';
  if (t.includes('titulo') || t.includes('bono') || t.includes('letra')) return 'Bonos';
  return 'Otros';
}

/**
 * quantity × unit_price, minding lots: some instruments (bonds, mostly) are quoted per lot of
 * `units_per_lot` units. IOL also sends `lot_price`; when it matches `unit_price` the quote
 * is for the whole lot, and when it is `unit_price × units_per_lot` the quote is per unit.
 * Without `lot_price`, a lot larger than one is taken as quoted per lot.
 */
function positionValue(p: Record<string, unknown>, asset: Record<string, unknown>) {
  const quantity = num(p.quantity);
  const unit = num(p.unit_price);
  if (quantity === undefined || unit === undefined) return undefined;
  const perLot = (num(asset.units_per_lot) ?? 1) > 1 ? num(asset.units_per_lot)! : 1;
  const lot = num(p.lot_price);
  const quotedPerLot =
    perLot > 1 && (lot === undefined || Math.abs(lot - unit) <= Math.abs(lot - unit * perLot));
  return quotedPerLot ? (quantity * unit) / perLot : quantity * unit;
}

/** Positions in get_portfolio (one country per call). */
export function normalizePortfolio(raw: unknown): Position[] {
  const data = unwrap(raw, 'positions');
  const positions = Array.isArray(data.positions) ? (data.positions as unknown[]) : [];
  return positions.flatMap((item): Position[] => {
    const p = obj(item);
    const asset = obj(p.asset);
    const currency = currencyOf(asset.currency);
    const value = positionValue(p, asset);
    if (!currency || value === undefined) return [];
    return [
      {
        symbol: str(asset.symbol),
        description: str(asset.description) || str(asset.symbol),
        type: assetCategory(str(asset.type)),
        currency,
        quantity: num(p.quantity) ?? 0,
        valueCents: Math.round(value * 100),
        dayChangePct: num(p.daily_change_pct),
      },
    ];
  });
}
