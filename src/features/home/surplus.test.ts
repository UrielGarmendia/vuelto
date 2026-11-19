import { describe, expect, it } from 'vitest';
import { newMeta } from '../../db/db';
import type { Recurring, Transaction } from '../../db/types';
import { monthSurplus } from './surplus';

const tx = (date: string, type: Transaction['type'], amountCents: number): Transaction => ({
  ...newMeta(0),
  type,
  amountCents,
  currency: 'ARS',
  date,
  accountId: 'a',
  tags: [],
});
const rule = (
  nextDate: string,
  type: 'income' | 'expense',
  amountCents: number,
  frequency: Recurring['frequency'] = 'monthly',
  active: 0 | 1 = 1,
): Recurring => ({
  ...newMeta(0),
  template: { type, amountCents, currency: 'ARS' },
  frequency,
  nextDate,
  active,
});

describe('monthSurplus', () => {
  const txs = [
    tx('2026-11-01', 'income', 100_000_000),
    tx('2026-11-03', 'expense', 30_000_000),
    tx('2026-11-10', 'transfer', 5_000_000),
    tx('2026-10-28', 'expense', 99_999_900),
  ];

  it('is income minus spending, minus what still repeats this month', () => {
    const rules = [
      rule('2026-11-20', 'expense', 2_000_000), // Netflix, still to come
      rule('2026-11-23', 'expense', 1_000_000, 'weekly'), // 23 and 30
      rule('2026-12-01', 'expense', 50_000_000), // next month: not counted
      rule('2026-11-25', 'income', 10_000_000), // a payment still coming in
      rule('2026-11-25', 'expense', 7_000_000, 'monthly', 0), // paused
    ];
    expect(monthSurplus(txs, rules, '2026-11-18')).toEqual({
      incomeCents: 100_000_000,
      expenseCents: 30_000_000,
      pendingCents: -2_000_000 - 2 * 1_000_000 + 10_000_000,
      surplusCents: 100_000_000 - 30_000_000 + 6_000_000,
    });
  });

  it('can be negative, and ignores past months and transfers', () => {
    const s = monthSurplus([tx('2026-11-02', 'expense', 1_000)], [], '2026-11-18');
    expect(s.surplusCents).toBe(-1_000);
    expect(monthSurplus([], [], '2026-11-18').surplusCents).toBe(0);
  });
});
