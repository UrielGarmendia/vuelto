import { db as defaultDb, newMeta, type VueltoDB } from '../../db/db';
import type { Goal } from '../../db/types';

/** Months from `today` to `deadline`, counting the current one, at least 1. */
export function monthsLeft(today: string, deadline: string): number {
  const [y1, m1] = today.split('-').map(Number);
  const [y2, m2] = deadline.split('-').map(Number);
  return Math.max(1, (y2! - y1!) * 12 + (m2! - m1!) + 1);
}

/** What to put aside each month to arrive on time; undefined without a deadline or once met. */
export function monthlyNeeded(
  goal: Pick<Goal, 'targetCents' | 'savedCents' | 'deadline'>,
  today: string,
) {
  const missing = goal.targetCents - goal.savedCents;
  if (!goal.deadline || missing <= 0) return undefined;
  return Math.ceil(missing / monthsLeft(today, goal.deadline));
}

export async function saveGoal(
  draft: Pick<Goal, 'name' | 'targetCents' | 'color' | 'deadline'>,
  id?: string,
  db: VueltoDB = defaultDb,
) {
  if (!Number.isSafeInteger(draft.targetCents) || draft.targetCents <= 0)
    throw new RangeError('Invalid target');
  const clean = { ...draft, name: draft.name.trim(), deadline: draft.deadline || undefined };
  if (id) await db.goals.update(id, { ...clean, updatedAt: Date.now(), synced: 0 });
  else await db.goals.add({ ...newMeta(), ...clean, savedCents: 0 });
}

/** Adds (or, negative, takes out) money from a goal; never below zero. */
export async function contribute(id: string, cents: number, db: VueltoDB = defaultDb) {
  await db.transaction('rw', db.goals, async () => {
    const g = await db.goals.get(id);
    if (!g) return;
    await db.goals.update(id, {
      savedCents: Math.max(0, g.savedCents + cents),
      updatedAt: Date.now(),
      synced: 0,
    });
  });
}
