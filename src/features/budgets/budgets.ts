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
