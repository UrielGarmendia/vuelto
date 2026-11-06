import { describe, expect, it } from 'vitest';
import type { Budget } from '../../db/types';
import { budgetsFor, monthBudget } from './budgets';

const b = (categoryId: string, month: string, amountCents: number, extra: Partial<Budget> = {}) =>
  ({
    id: `${categoryId}${month}`,
    createdAt: 0,
    updatedAt: 0,
    deleted: 0,
    synced: 0,
    categoryId,
    month,
    amountCents,
    ...extra,
  }) as Budget;

describe('budgets', () => {
  it('carries a budget forward until a later month changes it', () => {
    const all = [
      b('super', '2026-09', 1000),
      b('super', '2026-11', 1500),
      b('nafta', '2026-10', 400),
    ];
    expect(budgetsFor(all, '2026-10')).toEqual(
      new Map([
        ['super', 1000],
        ['nafta', 400],
      ]),
    );
    expect(monthBudget(all, '2026-12')).toBe(1900);
  });

  it('ignores future months, deleted rows and zeroed budgets', () => {
    const all = [
      b('super', '2027-01', 1000),
      b('nafta', '2026-10', 400, { deleted: 1 }),
      b('salud', '2026-10', 300),
      b('salud', '2026-11', 0),
    ];
    expect(monthBudget(all, '2026-11')).toBeUndefined();
  });
});
