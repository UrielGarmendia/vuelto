import { describe, expect, it } from 'vitest';
import { addMonthsISO } from '../../lib/dates';
import { dueOccurrences, installmentPlan, monthlyCost, nextOccurrence } from './schedule';

describe('addMonthsISO', () => {
  it('clamps to the end of shorter months and keeps the anchor day', () => {
    expect(addMonthsISO('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonthsISO('2026-02-28', 1, 31)).toBe('2026-03-31');
    expect(addMonthsISO('2026-11-15', 3)).toBe('2027-02-15');
  });
});

describe('installmentPlan', () => {
  it('starts on the purchase date and puts the remainder on the last one', () => {
    expect(installmentPlan(100_000, 3, '2026-11-30')).toEqual([
      { number: 1, amountCents: 33_333, date: '2026-11-30' },
      { number: 2, amountCents: 33_333, date: '2026-12-30' },
      { number: 3, amountCents: 33_334, date: '2027-01-30' },
    ]);
  });
});

describe('recurring', () => {
  it('advances weekly, monthly and yearly', () => {
    expect(nextOccurrence('2026-11-28', 'weekly', 28)).toBe('2026-12-05');
    expect(nextOccurrence('2027-02-28', 'monthly', 31)).toBe('2027-03-31');
    expect(nextOccurrence('2028-02-29', 'yearly', 29)).toBe('2029-02-28');
  });

  it('lists what is due up to today and where it continues', () => {
    expect(dueOccurrences('2026-09-10', 'monthly', 10, '2026-11-10')).toEqual({
      due: ['2026-09-10', '2026-10-10', '2026-11-10'],
      next: '2026-12-10',
    });
    expect(dueOccurrences('2026-12-01', 'monthly', 1, '2026-11-10').due).toEqual([]);
  });
});

describe('monthlyCost', () => {
  it('brings every frequency to a month', () => {
    expect(monthlyCost(1200, 'monthly')).toBe(1200);
    expect(monthlyCost(12000, 'yearly')).toBe(1000);
    expect(monthlyCost(300, 'weekly')).toBe(1300);
  });
});
