import { describe, expect, it } from 'vitest';
import { VueltoDB } from '../../db/db';
import type { Budget } from '../../db/types';
import { budgetsFor, closedWithin, crossedThreshold, monthBudget, saveBudget } from './budgets';

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

describe('crossedThreshold', () => {
  it('fires once at 80 % and once when going over', () => {
    expect(crossedThreshold(700, 800, 1000)).toBe(80);
    expect(crossedThreshold(800, 900, 1000)).toBeNull();
    expect(crossedThreshold(900, 1001, 1000)).toBe(100);
    expect(crossedThreshold(100, 1200, 1000)).toBe(100);
    expect(crossedThreshold(1100, 1200, 1000)).toBeNull();
    expect(crossedThreshold(0, 50, 0)).toBeNull();
  });
});

describe('saveBudget', () => {
  it('updates the same month and starts a new amount in a later one', async () => {
    const db = new VueltoDB(`budgets-${crypto.randomUUID()}`);
    await saveBudget('super', '2026-10', 1000, db);
    await saveBudget('super', '2026-10', 1200, db);
    await saveBudget('super', '2026-12', 0, db);
    const all = await db.budgets.toArray();
    expect(all).toHaveLength(2);
    expect(budgetsFor(all, '2026-11').get('super')).toBe(1200);
    expect(budgetsFor(all, '2026-12').has('super')).toBe(false);
    await db.delete();
  });
});

describe('closedWithin', () => {
  it('needs a budget and spending at or under it', () => {
    const all = [b('super', '2026-10', 1000)];
    expect(closedWithin(all, 1000, '2026-10')).toBe(true);
    expect(closedWithin(all, 1001, '2026-10')).toBe(false);
    expect(closedWithin(all, 0, '2026-09')).toBe(false);
  });
});
