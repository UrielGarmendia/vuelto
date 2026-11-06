import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { VueltoDB } from '../../db/db';
import { createTransaction, runRecurring, setGroupDeleted, updateGroup } from './create';

let db: VueltoDB;
beforeEach(async () => {
  db = new VueltoDB(`create-${crypto.randomUUID()}`);
  await db.open();
});
afterEach(() => db.delete());

const draft = {
  type: 'expense' as const,
  amountCents: 100_000,
  currency: 'ARS' as const,
  date: '2026-11-30',
  categoryId: 'c',
  accountId: 'a',
  note: ' Heladera ',
};

describe('createTransaction', () => {
  it('splits a purchase into linked monthly installments', async () => {
    await createTransaction(draft, { installments: 3 }, db);
    const rows = (await db.transactions.toArray()).sort((a, b) => a.date.localeCompare(b.date));
    expect(rows.map((r) => [r.date, r.amountCents, r.installment?.number])).toEqual([
      ['2026-11-30', 33_333, 1],
      ['2026-12-30', 33_333, 2],
      ['2027-01-30', 33_334, 3],
    ]);
    expect(new Set(rows.map((r) => r.installment?.groupId)).size).toBe(1);
    expect(rows[0]!.note).toBe('Heladera');
  });

  it('edits and deletes all installments together', async () => {
    await createTransaction(draft, { installments: 2 }, db);
    const groupId = (await db.transactions.toCollection().first())!.installment!.groupId;
    await updateGroup(groupId, { categoryId: 'x', accountId: 'b', note: 'Tele' }, db);
    expect(
      (await db.transactions.toArray()).every((r) => r.categoryId === 'x' && r.note === 'Tele'),
    ).toBe(true);
    await setGroupDeleted(groupId, 1, db);
    expect((await db.transactions.toArray()).every((r) => r.deleted === 1)).toBe(true);
  });

  it('starts a monthly series and generates what came due, once', async () => {
    await createTransaction(
      { ...draft, date: '2026-09-30', note: 'Alquiler' },
      { repeat: 'monthly' },
      db,
    );
    expect(await runRecurring('2026-11-30', db)).toBe(2);
    expect(await runRecurring('2026-11-30', db)).toBe(0);
    const dates = (await db.transactions.toArray()).map((r) => r.date).sort();
    expect(dates).toEqual(['2026-09-30', '2026-10-30', '2026-11-30']);
    const rule = (await db.recurring.toArray())[0]!;
    expect(rule.nextDate).toBe('2026-12-30');
  });

  it('skips paused rules', async () => {
    await createTransaction({ ...draft, date: '2026-10-01' }, { repeat: 'weekly' }, db);
    const rule = (await db.recurring.toArray())[0]!;
    await db.recurring.update(rule.id, { active: 0 });
    expect(await runRecurring('2026-11-30', db)).toBe(0);
  });

  it('rejects a transfer to the same account', async () => {
    await expect(
      createTransaction({ ...draft, type: 'transfer', toAccountId: 'a' }, {}, db),
    ).rejects.toThrow(RangeError);
  });

  it('two devices generating the same occurrence end up with one copy, and edits win', async () => {
    await createTransaction({ ...draft, date: '2026-09-30' }, { repeat: 'monthly' }, db);
    const rule = (await db.recurring.toArray())[0]!;
    await runRecurring('2026-10-30', db);
    const id = `${rule.id}:2026-10-30`;
    await db.transactions.update(id, { note: 'editado', updatedAt: Date.now() });
    // Another device that has not synced yet makes its own copy of the same occurrence.
    const other = new VueltoDB(`create-other-${crypto.randomUUID()}`);
    await other.recurring.add({ ...rule, nextDate: '2026-10-30' });
    await runRecurring('2026-10-30', other);
    const theirs = (await other.transactions.get(id))!;
    expect(theirs.updatedAt).toBeLessThan((await db.transactions.get(id))!.updatedAt);
    await other.delete();
  });
});
