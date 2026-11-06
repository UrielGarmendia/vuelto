import { describe, expect, it } from 'vitest';
import type { Transaction } from '../../db/types';
import { categoryShifts, pickInsight, projectMonth, weekdayPeak } from './insights';

let n = 0;
const tx = (
  date: string,
  categoryId: string,
  amountCents: number,
  extra: Partial<Transaction> = {},
) =>
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
    date,
    categoryId,
    amountCents,
    ...extra,
  }) as Transaction;

describe('categoryShifts', () => {
  it('compares against last month only up to the same day', () => {
    const shifts = categoryShifts(
      [
        tx('2026-11-05', 'comida', 1_400_000),
        tx('2026-10-04', 'comida', 1_000_000),
        tx('2026-10-20', 'comida', 9_000_000), // after the 10th of last month: not compared
        tx('2026-11-12', 'comida', 9_000_000), // after today: not counted
      ],
      '2026-11-10',
    );
    expect(shifts).toEqual([
      { categoryId: 'comida', nowCents: 1_400_000, beforeCents: 1_000_000, pct: 40 },
    ]);
  });

  it('cuts a short previous month at its last day', () => {
    const shifts = categoryShifts(
      [tx('2026-03-31', 'super', 500), tx('2026-02-28', 'super', 1000)],
      '2026-03-31',
    );
    expect(shifts[0]!.beforeCents).toBe(1000);
  });
});

describe('projectMonth', () => {
  it('extends the pace to the whole month', () => {
    expect(projectMonth(1_000, 10, 30)).toBe(3_000);
    expect(projectMonth(1_000, 0, 30)).toBe(0);
  });
});

describe('weekdayPeak', () => {
  it('finds the most expensive weekday', () => {
    // 2026-11-07 and 2026-10-31 are Saturdays.
    const peak = weekdayPeak(
      [tx('2026-11-07', 'x', 9000), tx('2026-10-31', 'x', 9000), tx('2026-11-03', 'x', 2000)],
      '2026-11-10',
    );
    expect(peak?.weekday).toBe(6);
    expect(peak!.ratio).toBeCloseTo(18000 / (20000 / 7));
    expect(weekdayPeak([], '2026-11-10')).toBeNull();
  });
});

describe('pickInsight', () => {
  it('prefers a category running hot, then one cooling down', () => {
    const hot = [tx('2026-11-03', 'comida', 2_000_000), tx('2026-10-03', 'comida', 1_000_000)];
    expect(pickInsight(hot, '2026-11-10')).toMatchObject({ kind: 'up', categoryId: 'comida' });
    const cold = [tx('2026-11-03', 'super', 500_000), tx('2026-10-03', 'super', 2_000_000)];
    expect(pickInsight(cold, '2026-11-10')).toMatchObject({ kind: 'down', pct: -75 });
  });

  it('ignores small changes and falls back to the weekday', () => {
    const small = [tx('2026-11-07', 'cafe', 300_000), tx('2026-10-07', 'cafe', 100_000)];
    expect(pickInsight(small, '2026-11-10')).toMatchObject({ kind: 'weekday' });
    expect(pickInsight([], '2026-11-10')).toBeNull();
  });
});
