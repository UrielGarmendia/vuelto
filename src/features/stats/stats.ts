import type { Transaction } from '../../db/types';
import { arsCents } from '../../lib/money';
import { fromISODate } from '../../lib/dates';
import { addMonths } from '../home/summary';

const spending = (tx: Transaction) => !tx.deleted && tx.type === 'expense';

/** Spending per category within `month` (optionally only up to day `upTo`), biggest first. */
export function categoryTotals(txs: readonly Transaction[], month: string, upTo = 31) {
  const by = new Map<string, number>();
  for (const tx of txs) {
    if (!spending(tx) || !tx.date.startsWith(month) || Number(tx.date.slice(8)) > upTo) continue;
    const id = tx.categoryId ?? '';
    by.set(id, (by.get(id) ?? 0) + arsCents(tx));
  }
  return [...by]
    .map(([categoryId, cents]) => ({ categoryId, cents }))
    .sort((a, b) => b.cents - a.cents);
}

/** Spending of the `n` months ending at `month`, oldest first. */
export function monthSeries(txs: readonly Transaction[], month: string, n = 12) {
  const months = Array.from({ length: n }, (_, i) => addMonths(month, i - n + 1));
  const by = new Map(months.map((m) => [m, 0]));
  for (const tx of txs) {
    if (!spending(tx)) continue;
    const m = tx.date.slice(0, 7);
    if (by.has(m)) by.set(m, by.get(m)! + arsCents(tx));
  }
  return months.map((m) => ({ month: m, cents: by.get(m)! }));
}

/** Average spending per weekday (0 = Sunday) over `month`. */
export function weekdaySpending(txs: readonly Transaction[], month: string, lastDay: number) {
  const total = Array<number>(7).fill(0);
  const count = Array<number>(7).fill(0);
  for (let d = 1; d <= lastDay; d++)
    count[fromISODate(`${month}-${String(d).padStart(2, '0')}`).getDay()]!++;
  for (const tx of txs) {
    if (!spending(tx) || !tx.date.startsWith(month) || Number(tx.date.slice(8)) > lastDay) continue;
    total[fromISODate(tx.date).getDay()]! += arsCents(tx);
  }
  return total.map((t, i) => (count[i] ? Math.round(t / count[i]!) : 0));
}
