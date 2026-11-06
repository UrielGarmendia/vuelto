import { describe, expect, it } from 'vitest';
import type { Transaction } from '../../db/types';
import { categoryTotals, monthSeries, weekdaySpending } from './stats';

let n = 0;
const tx = (date: string, amountCents: number, extra: Partial<Transaction> = {}) =>
  ({
    id: `t${n++}`,
    createdAt: 0,
    updatedAt: 0,
    deleted: 0,
    synced: 0,
    type: 'expense',
    currency: 'ARS',
    accountId: 'a',
    tags: [],
    categoryId: 'super',
    date,
    amountCents,
    ...extra,
  }) as Transaction;

describe('stats', () => {
  const txs = [
    tx('2026-11-02', 100),
    tx('2026-11-03', 300, { categoryId: 'comida' }),
    tx('2026-11-04', 50),
    tx('2026-10-04', 70),
    tx('2026-11-05', 999, { type: 'income' }),
    tx('2026-11-06', 999, { deleted: 1 }),
  ];

  it('totals categories, biggest first', () => {
    expect(categoryTotals(txs, '2026-11')).toEqual([
      { categoryId: 'comida', cents: 300 },
      { categoryId: 'super', cents: 150 },
    ]);
  });

  it('can stop at a day of the month', () => {
    expect(categoryTotals(txs, '2026-11', 2)).toEqual([{ categoryId: 'super', cents: 100 }]);
  });

  it('builds a series of months ending at the chosen one', () => {
    const series = monthSeries(txs, '2026-11', 3);
    expect(series).toEqual([
      { month: '2026-09', cents: 0 },
      { month: '2026-10', cents: 70 },
      { month: '2026-11', cents: 450 },
    ]);
  });

  it('averages each weekday over the days elapsed', () => {
    // Nov 2026: the 2nd is a Monday; up to the 7th there is one of each weekday but Sunday (1st).
    const avg = weekdaySpending(txs, '2026-11', 7);
    expect(avg[1]).toBe(100);
    expect(avg[2]).toBe(300);
    expect(avg[0]).toBe(0);
  });
});
