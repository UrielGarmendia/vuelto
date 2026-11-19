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

/** Words that stay lowercase inside a name, and short ones that are not acronyms. */
const SMALL = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'y', 'e', 'en', 'of', 'the', 'and']);
const PLAIN = new Set(['inc', 'co', 'cia', 'ltd', 'plc', 'corp', 'mas', 'sur', 'oro']);

/**
 * IOL's descriptions as people would write them: "CEDEAR APPLE INC." → "Apple Inc.",
 * "GRUPO FINANCIERO GALICIA" → "Grupo Financiero Galicia", "... (IBI" (cut) → "...".
 * Short all-caps words stay acronyms (YPF, ADR, ETF, SA).
 */
export function cleanAssetName(raw: string): string {
  let s = raw.replace(/^\s*cedears?(?![\p{L}])[\s.:-]*/iu, '').trim();
  const open = s.lastIndexOf('(');
  if (open >= 0 && !s.slice(open).includes(')')) s = s.slice(0, open).trim();
  s = s.replace(/[\s,;:-]+$/, '');
  return s
    .split(/\s+/)
    .map((word, i) => {
      const letters = word.replace(/[^\p{L}]/gu, '');
      const lower = word.toLowerCase();
      if (i > 0 && SMALL.has(lower)) return lower;
      // Initials with dots (S.A., L.A) stay; an abbreviation like "REP." is a word.
      const initials = /^(\p{L}\.)+\p{L}?\.?$/u.test(word);
      const acronym =
        initials ||
        (letters.length > 0 &&
          letters.length <= 3 &&
          !word.includes('.') &&
          letters === letters.toUpperCase() &&
          !PLAIN.has(letters.toLowerCase()));
      if (acronym || /\d/.test(word)) return word;
      return lower.replace(/(^|-)(\p{L})/gu, (_, sep: string, c: string) => sep + c.toUpperCase());
    })
    .join(' ');
}

/** Positions in get_portfolio (one country per call). */
export function normalizePortfolio(raw: unknown): Position[] {
  const data = unwrap(raw, 'positions');
  const positions = Array.isArray(data.positions) ? (data.positions as unknown[]) : [];
  const country = countryOf(data.country);
  return positions.flatMap((item): Position[] => {
    const p = obj(item);
    const asset = obj(p.asset);
    const currency = currencyOf(asset.currency);
    const value = positionValue(p, asset);
    if (!currency || value === undefined) return [];
    return [
      {
        symbol: str(asset.symbol),
        description: cleanAssetName(str(asset.description)) || str(asset.symbol),
        type: assetCategory(str(asset.type)),
        currency,
        quantity: num(p.quantity) ?? 0,
        valueCents: Math.round(value * 100),
        dayChangePct: num(p.daily_change_pct),
        price: num(p.unit_price),
        market: str(asset.market) || undefined,
        country: country ?? countryOf(asset.country) ?? 'ARG',
      },
    ];
  });
}

const countryOf = (v: unknown): 'ARG' | 'USA' | undefined => {
  const s = str(v).toUpperCase();
  if (s === 'USA' || s === 'US' || s === 'EEUU' || s === 'ESTADOS_UNIDOS') return 'USA';
  if (s === 'ARG' || s === 'AR' || s === 'ARGENTINA') return 'ARG';
  return undefined;
};

/** The first list of objects (at most a few levels down) whose items pass `test`. */
function findRows(raw: unknown, test: (o: Record<string, unknown>) => boolean, depth = 0) {
  if (Array.isArray(raw)) {
    const rows = raw.map(obj).filter(test);
    if (rows.length) return rows;
  }
  if (depth > 3 || typeof raw !== 'object' || raw === null) return [];
  for (const v of Object.values(raw)) {
    const rows: Record<string, unknown>[] = findRows(v, test, depth + 1);
    if (rows.length) return rows;
  }
  return [];
}

export interface PricePoint {
  /** Milliseconds since the epoch. */
  t: number;
  close: number;
}

/** get_price_history: one daily bar per session, its time a Unix timestamp. */
export function normalizePriceHistory(raw: unknown): PricePoint[] {
  return findRows(raw, (o) => num(o.close) !== undefined)
    .flatMap((b): PricePoint[] => {
      const when = b.time ?? b.t ?? b.date;
      let t = typeof when === 'string' ? Date.parse(when) : (num(when) ?? NaN);
      // Unix timestamps in seconds; anything already in milliseconds is left alone.
      if (t < 1e12) t *= 1000;
      return Number.isFinite(t) ? [{ t, close: num(b.close)! }] : [];
    })
    .sort((a, b) => a.t - b.t);
}

export interface AumPoint {
  date: string;
  /** Everything held at IOL that day (cash included), in peso cents. */
  cents: number;
  /** The same in MEP dollar cents, when IOL says it. */
  mepCents?: number;
}

const DAY = /^\d{4}-\d{2}-\d{2}/;
/** IOL's own fields first; the rest are guesses for answers shaped differently. */
const VALUE_KEYS = ['valuation_ars', 'aum', 'total', 'value', 'amount', 'balance', 'valorizado'];

/**
 * get_aum_evolution: `{ snapshots: [{ date, valuation_ars, valuation_mep,
 * exchange_rate_mep, daily_deposit_ars, client_id, … }], missing_dates, status }`. The
 * valuation includes cash (it jumps on a deposit). "Partial" means IOL is still filling in
 * dates. Ids are never taken for amounts.
 */
export function normalizeAum(raw: unknown): { points: AumPoint[]; partial: boolean } {
  const dateOf = (o: Record<string, unknown>) =>
    Object.values(o).find((v): v is string => typeof v === 'string' && DAY.test(v));
  const points = findRows(raw, (o) => dateOf(o) !== undefined)
    .flatMap((o): AumPoint[] => {
      const key = VALUE_KEYS.find((k) => num(o[k]) !== undefined);
      if (!key) return [];
      const mep = num(o.valuation_mep);
      return [
        {
          date: dateOf(o)!.slice(0, 10),
          cents: cents(o[key]),
          ...(mep !== undefined ? { mepCents: cents(mep) } : {}),
        },
      ];
    })
    .sort((a, b) => a.date.localeCompare(b.date));
  const status = JSON.stringify(raw ?? '').match(/"status"\s*:\s*"([^"]*)"/)?.[1] ?? '';
  return { points, partial: /partial/i.test(status) };
}
