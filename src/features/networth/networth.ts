import { usePrefs } from '../../app/prefs';
import { db as defaultDb, newMeta, type VueltoDB } from '../../db/db';
import type { Account, Meta, NetWorthDay } from '../../db/types';
import { fromISODate, todayISO, toISODate } from '../../lib/dates';
import type { Rates } from '../currency/rates';
import { cashTotal, investedTotal, type Snapshot } from '../external/provider';
import { accountBalances, totals } from '../home/summary';
import type { HoldingsHistory } from '../iol/iol';

export type NetWorthFields = Omit<NetWorthDay, keyof Meta>;

/**
 * One day's net worth, split the way Inicio shows it: IOL's cash counts as available and
 * only its positions as invested. Dollars convert at `usdRate` and are left out without one.
 */
export function netWorthOf({
  date,
  accounts,
  balances,
  snapshot,
  usdRate,
  mepRate,
}: {
  date: string;
  accounts: readonly Account[];
  balances: Map<string, number>;
  snapshot?: Snapshot;
  usdRate?: number;
  mepRate?: number;
}): NetWorthFields {
  // Linked accounts (IOL) are counted from their snapshot, not from movements.
  const own = accounts.filter((a) => !a.deleted && !a.external);
  const { balanceCents, creditDebtCents } = totals(own, balances, usdRate);
  const availableCents =
    balanceCents + creditDebtCents + (snapshot ? cashTotal(snapshot, usdRate) : 0);
  const investedCents = snapshot ? investedTotal(snapshot, usdRate) : 0;
  const totalCents = availableCents + investedCents - creditDebtCents;
  return {
    date,
    accounts: own.map((a) => ({ id: a.id, cents: balances.get(a.id) ?? 0, currency: a.currency })),
    availableCents,
    investedCents,
    debtCents: creditDebtCents,
    totalCents,
    ...(usdRate ? { usdRate, totalUsdCents: Math.round(totalCents / usdRate) } : {}),
    ...(mepRate ? { mepRate } : {}),
  };
}

const same = (a: NetWorthFields, b: NetWorthFields) =>
  a.availableCents === b.availableCents &&
  a.investedCents === b.investedCents &&
  a.debtCents === b.debtCents &&
  a.totalCents === b.totalCents &&
  a.usdRate === b.usdRate &&
  a.mepRate === b.mepRate &&
  JSON.stringify(a.accounts) === JSON.stringify(b.accounts);

/** Takes (or refreshes) today's row. At most one per date; unchanged days are not rewritten. */
export async function recordNetWorth(today = todayISO(), db: VueltoDB = defaultDb): Promise<void> {
  const [accounts, txs, rates, cached] = await Promise.all([
    db.accounts.toArray(),
    db.transactions.where('deleted').equals(0).toArray(),
    db.kv.get('rates'),
    db.kv.get('iol-snapshot'),
  ]);
  const linked = accounts.some((a) => a.external?.provider === 'iol' && !a.deleted);
  const values = (rates?.value as Rates | undefined)?.values;
  const usdRate = values?.[usePrefs.getState().rateKind];
  const row = netWorthOf({
    date: today,
    accounts,
    balances: accountBalances(accounts, txs),
    snapshot: linked ? (cached?.value as Snapshot | undefined) : undefined,
    usdRate,
    mepRate: values?.mep,
  });
  const existing = await db.netWorth.get(today);
  if (existing && !existing.deleted && same(existing, row)) return;
  const now = Date.now();
  await db.netWorth.put({
    ...newMeta(now),
    ...(existing ? { createdAt: existing.createdAt } : {}),
    ...row,
    id: today,
  });
}

export type Range = '1M' | '3M' | '6M' | '1A' | 'Todo';
export const RANGE_DAYS: Record<Exclude<Range, 'Todo'>, number> = {
  '1M': 31,
  '3M': 92,
  '6M': 183,
  '1A': 366,
};

export interface Point {
  date: string;
  available: number;
  invested: number;
  debt: number;
  total: number;
  /** False for days filled from IOL's own history (only the invested part is known). */
  own: boolean;
}

/**
 * The curve for a range, in ARS or USD cents. Vuelto's own days come first; before the
 * first of them, IOL's holdings history fills in the invested part, its dollars converted at
 * today's rate (there is no history of rates). Days without a rate are skipped in USD.
 */
export function netWorthSeries({
  days,
  history,
  range,
  currency,
  today,
  rate,
}: {
  days: readonly NetWorthDay[];
  history?: HoldingsHistory;
  range: Range;
  currency: 'ARS' | 'USD';
  today: string;
  rate?: number;
}): Point[] {
  const from =
    range === 'Todo'
      ? ''
      : toISODate(new Date(fromISODate(today).getTime() - RANGE_DAYS[range] * 86_400_000));
  const own = days.filter((d) => !d.deleted && d.date >= from && d.date <= today);
  const first = [...days]
    .filter((d) => !d.deleted)
    .sort((a, b) => a.date.localeCompare(b.date))[0]?.date;

  const points: Point[] = [];
  for (const d of own) {
    // In dollars, the MEP of each day (older rows without it fall back to their rate).
    const dollar = d.mepRate ?? d.usdRate;
    const k = currency === 'ARS' ? 1 : dollar ? 1 / dollar : 0;
    if (!k) continue;
    const r = (c: number) => Math.round(c * k);
    points.push({
      date: d.date,
      available: r(d.availableCents),
      invested: r(d.investedCents),
      debt: r(d.debtCents),
      total: r(d.totalCents),
      own: true,
    });
  }

  if (history) {
    const byDate = new Map<string, number>();
    for (const p of [...history.ARG, ...history.USA]) {
      // In dollars, IOL's own MEP valuation of that day; without it, today's rate.
      const value =
        currency === 'ARS'
          ? p.cents
          : (p.mepCents ?? (rate ? Math.round(p.cents / rate) : undefined));
      if (value !== undefined) byDate.set(p.date, (byDate.get(p.date) ?? 0) + value);
    }
    for (const [date, invested] of byDate) {
      if (date < from || date > today || (first && date >= first)) continue;
      points.push({ date, available: 0, invested, debt: 0, total: invested, own: false });
    }
  }
  return points.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Change between the first and last full days of the curve. With fewer than two of those,
 * IOL's history alone (`iolOnly`); undefined when neither has two days.
 */
export function periodChange(points: readonly Point[]) {
  const own = points.filter((p) => p.own);
  const iol = points.filter((p) => !p.own);
  const pair = own.length >= 2 ? own : iol.length >= 2 ? iol : undefined;
  if (!pair) return undefined;
  const a = pair[0]!;
  const b = pair[pair.length - 1]!;
  return {
    cents: b.total - a.total,
    pct: a.total ? ((b.total - a.total) / Math.abs(a.total)) * 100 : undefined,
    iolOnly: pair === iol,
  };
}
