import { describe, expect, it } from 'vitest';
import { VueltoDB } from '../../db/db';
import { contribute, monthlyNeeded, monthsLeft, saveGoal } from './goals';

describe('goals', () => {
  it('counts the months left, this one included', () => {
    expect(monthsLeft('2026-11-06', '2026-11-30')).toBe(1);
    expect(monthsLeft('2026-11-06', '2027-02-01')).toBe(4);
    expect(monthsLeft('2026-11-06', '2026-01-01')).toBe(1);
  });

  it('spreads what is missing over the months left', () => {
    const g = { targetCents: 100_000, savedCents: 40_000, deadline: '2027-01-15' };
    expect(monthlyNeeded(g, '2026-11-06')).toBe(20_000);
    expect(monthlyNeeded({ ...g, deadline: undefined }, '2026-11-06')).toBeUndefined();
    expect(monthlyNeeded({ ...g, savedCents: 100_000 }, '2026-11-06')).toBeUndefined();
  });

  it('adds and takes out money without going below zero', async () => {
    const db = new VueltoDB(`goals-${crypto.randomUUID()}`);
    await saveGoal({ name: ' Viaje ', targetCents: 1000, color: '#75AADB' }, undefined, db);
    const id = (await db.goals.toCollection().first())!.id;
    await contribute(id, 600, db);
    await contribute(id, -900, db);
    expect(await db.goals.get(id)).toMatchObject({ name: 'Viaje', savedCents: 0 });
    await expect(
      saveGoal({ name: 'x', targetCents: 0, color: '' }, undefined, db),
    ).rejects.toThrow();
    await db.delete();
  });
});
