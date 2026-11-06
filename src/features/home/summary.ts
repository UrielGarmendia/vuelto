import type { Account, Transaction } from '../../db/types';
import { arsCents } from '../../lib/money';

/** Balance per account: initial + income − expense, with transfers moving money between accounts. */
export function accountBalances(
  accounts: readonly Account[],
  txs: readonly Transaction[],
): Map<string, number> {
  const balances = new Map(accounts.map((a) => [a.id, a.initialBalanceCents]));
  const add = (id: string | undefined, cents: number) => {
    if (id !== undefined && balances.has(id)) balances.set(id, balances.get(id)! + cents);
  };
  for (const tx of txs) {
    if (tx.deleted) continue;
    if (tx.type === 'income') add(tx.accountId, tx.amountCents);
    else if (tx.type === 'expense') add(tx.accountId, -tx.amountCents);
    else {
      add(tx.accountId, -tx.amountCents);
      add(tx.toAccountId, tx.amountCents);
    }
  }
  return balances;
}

export interface Totals {
  /** Sum of ARS accounts; credit cards count (negative balance = debt). */
  balanceCents: number;
  /** Money owed on credit accounts, as a positive number. */
  creditDebtCents: number;
}

/** In pesos; dollar accounts convert at `usdRate` (ARS per dollar) and are left out without one. */
export function totals(
  accounts: readonly Account[],
  balances: Map<string, number>,
  usdRate?: number,
): Totals {
  let balanceCents = 0;
  let creditDebtCents = 0;
  for (const a of accounts) {
    if (a.deleted || (a.currency !== 'ARS' && !usdRate)) continue;
    const raw = balances.get(a.id) ?? 0;
    const b = a.currency === 'ARS' ? raw : Math.round(raw * usdRate!);
    balanceCents += b;
    if (a.kind === 'credit' && b < 0) creditDebtCents -= b;
  }
  return { balanceCents, creditDebtCents };
}

export function monthTotals(txs: readonly Transaction[], month: string) {
  let expenseCents = 0;
  let incomeCents = 0;
  for (const tx of txs) {
    if (tx.deleted || !tx.date.startsWith(month)) continue;
    if (tx.type === 'expense') expenseCents += arsCents(tx);
    else if (tx.type === 'income') incomeCents += arsCents(tx);
  }
  return { expenseCents, incomeCents };
}

/** "2026-11" → 30. */
export function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number);
  return new Date(y!, m!, 0).getDate();
}

/** "2026-01", -1 → "2025-12". */
export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y!, m! - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Spending on each day of `month` (index 0 is the 1st). */
export function monthDaily(txs: readonly Transaction[], month: string): number[] {
  const series = Array<number>(daysInMonth(month)).fill(0);
  for (const tx of txs) {
    if (tx.deleted || tx.type !== 'expense') continue;
    if (!tx.date.startsWith(month)) continue;
    series[Number(tx.date.slice(8)) - 1]! += arsCents(tx);
  }
  return series;
}

/** Spending of the `n` months before `month`, most recent first. */
export function pastMonths(txs: readonly Transaction[], month: string, n: number) {
  const months = Array.from({ length: n }, (_, i) => addMonths(month, -(i + 1)));
  const spent = new Map(months.map((m) => [m, 0]));
  for (const tx of txs) {
    if (tx.deleted || tx.type !== 'expense') continue;
    const m = tx.date.slice(0, 7);
    if (spent.has(m)) spent.set(m, spent.get(m)! + arsCents(tx));
  }
  return months.map((m) => ({ month: m, days: daysInMonth(m), spentCents: spent.get(m)! }));
}

/**
 * How the previous months (those with any spending, up to `n`) were going by `day`: their
 * average spent up to that day and their average whole-month total. Fixed costs at the start
 * of the month (rent) make a straight per-day line misleading; this keeps the comparison fair.
 */
export function pastPace(txs: readonly Transaction[], month: string, day: number, n = 3) {
  const months = Array.from({ length: 12 }, (_, i) => addMonths(month, -(i + 1)));
  const sums = new Map(months.map((m) => [m, { upTo: 0, total: 0 }]));
  for (const tx of txs) {
    if (tx.deleted || tx.type !== 'expense') continue;
    const s = sums.get(tx.date.slice(0, 7));
    if (!s) continue;
    s.total += arsCents(tx);
    if (Number(tx.date.slice(8)) <= day) s.upTo += arsCents(tx);
  }
  const used = months
    .map((m) => sums.get(m)!)
    .filter((s) => s.total > 0)
    .slice(0, n);
  if (used.length === 0) return null;
  const avg = (k: 'upTo' | 'total') => used.reduce((a, s) => a + s[k], 0) / used.length;
  return { upToDay: avg('upTo'), total: avg('total') };
}
