import { db as defaultDb, newMeta, type VueltoDB } from '../../db/db';
import type { Budget } from '../../db/types';

/**
 * A budget holds from its month on, until a later month sets a new amount for that category
 * (an amount of 0 removes it). Returns the amount per category in force for `month`.
 */
export function budgetsFor(budgets: readonly Budget[], month: string): Map<string, number> {
  const latest = new Map<string, Budget>();
  for (const b of budgets) {
    if (b.deleted || b.month > month) continue;
    const prev = latest.get(b.categoryId);
    if (!prev || b.month > prev.month || (b.month === prev.month && b.updatedAt > prev.updatedAt))
      latest.set(b.categoryId, b);
  }
  const out = new Map<string, number>();
  for (const [cat, b] of latest) if (b.amountCents > 0) out.set(cat, b.amountCents);
  return out;
}

/** The month's total budget, or undefined when no category has one. */
export function monthBudget(budgets: readonly Budget[], month: string): number | undefined {
  const all = [...budgetsFor(budgets, month).values()];
  return all.length ? all.reduce((a, b) => a + b, 0) : undefined;
}

/** The threshold a new expense just crossed (80 % or 100 % of the budget), if any. */
export function crossedThreshold(before: number, after: number, budget: number): 80 | 100 | null {
  if (budget <= 0) return null;
  if (before <= budget && after > budget) return 100;
  if (before < budget * 0.8 && after >= budget * 0.8) return 80;
  return null;
}

/** Sets a category's budget from `month` on (0 removes it from that month on). */
export async function saveBudget(
  categoryId: string,
  month: string,
  amountCents: number,
  db: VueltoDB = defaultDb,
): Promise<void> {
  if (!Number.isSafeInteger(amountCents) || amountCents < 0) throw new RangeError('Invalid budget');
  const existing = await db.budgets.where('[categoryId+month]').equals([categoryId, month]).first();
  if (existing) {
    await db.budgets.update(existing.id, {
      amountCents,
      deleted: 0,
      updatedAt: Date.now(),
      synced: 0,
    });
  } else {
    await db.budgets.add({ ...newMeta(), categoryId, month, amountCents });
  }
}

/** True when `month` had a budget and its spending stayed within it. */
export function closedWithin(budgets: readonly Budget[], spentCents: number, month: string) {
  const budget = monthBudget(budgets, month);
  return budget !== undefined && spentCents <= budget;
}
