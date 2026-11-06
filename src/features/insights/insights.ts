import type { Transaction } from '../../db/types';
import { arsCents } from '../../lib/money';
import { addDays, fromISODate } from '../../lib/dates';
import { addMonths, daysInMonth } from '../home/summary';

const counts = (tx: Transaction) => !tx.deleted && tx.type === 'expense';

export interface CategoryShift {
  categoryId: string;
  nowCents: number;
  beforeCents: number;
  /** Percent change against last month; +40 means 40 % more. */
  pct: number;
}

/** This month so far, per category, against last month up to the same day (a fair pace). */
export function categoryShifts(txs: readonly Transaction[], today: string): CategoryShift[] {
  const month = today.slice(0, 7);
  const prev = addMonths(month, -1);
  const cut = `${prev}-${String(Math.min(Number(today.slice(8)), daysInMonth(prev))).padStart(2, '0')}`;
  const now = new Map<string, number>();
  const before = new Map<string, number>();
  for (const tx of txs) {
    if (!counts(tx) || !tx.categoryId) continue;
    if (tx.date.startsWith(month) && tx.date <= today)
      now.set(tx.categoryId, (now.get(tx.categoryId) ?? 0) + arsCents(tx));
    else if (tx.date.startsWith(prev) && tx.date <= cut)
      before.set(tx.categoryId, (before.get(tx.categoryId) ?? 0) + arsCents(tx));
  }
  return [...before]
    .map(([categoryId, beforeCents]) => {
      const nowCents = now.get(categoryId) ?? 0;
      return {
        categoryId,
        nowCents,
        beforeCents,
        pct: Math.round(((nowCents - beforeCents) / beforeCents) * 100),
      };
    })
    .sort((a, b) => Math.abs(b.nowCents - b.beforeCents) - Math.abs(a.nowCents - a.beforeCents));
}

/** End-of-month spending if the rest of the month keeps today's pace. */
export function projectMonth(spentSoFar: number, day: number, days: number): number {
  return day > 0 ? Math.round((spentSoFar / day) * days) : 0;
}

/** The weekday with the most spending over the last `weeks` weeks (0 = Sunday). */
export function weekdayPeak(txs: readonly Transaction[], today: string, weeks = 8) {
  const from = addDays(today, -(weeks * 7 - 1));
  const byDay = Array<number>(7).fill(0);
  for (const tx of txs) {
    if (!counts(tx) || tx.date < from || tx.date > today) continue;
    byDay[fromISODate(tx.date).getDay()]! += arsCents(tx);
  }
  const total = byDay.reduce((a, b) => a + b, 0);
  if (total === 0) return null;
  const weekday = byDay.indexOf(Math.max(...byDay));
  return { weekday, ratio: byDay[weekday]! / (total / 7) };
}

export type Insight =
  ({ kind: 'up' | 'down' } & CategoryShift) | { kind: 'weekday'; weekday: number; ratio: number };

/** Below these a change is noise, not news. */
const MIN_DIFF = 500_000;
const MIN_PCT = 20;

/** The one thing worth saying on Inicio: a category running hot, one cooling down, or the
 * day of the week that costs the most. */
export function pickInsight(txs: readonly Transaction[], today: string): Insight | null {
  const shifts = categoryShifts(txs, today).filter(
    (s) => Math.abs(s.nowCents - s.beforeCents) >= MIN_DIFF && Math.abs(s.pct) >= MIN_PCT,
  );
  const up = shifts.find((s) => s.pct > 0);
  if (up) return { kind: 'up', ...up };
  const down = shifts.find((s) => s.pct < 0);
  if (down) return { kind: 'down', ...down };
  const peak = weekdayPeak(txs, today);
  return peak && peak.ratio >= 1.3 ? { kind: 'weekday', ...peak } : null;
}
