import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { VueltoDB } from '../../db/db';
import {
  groupByDay,
  listTransactions,
  saveTransaction,
  setDeleted,
  splitShare,
  tagsOf,
  type TxDraft,
} from './queries';

let db: VueltoDB;
let draft: TxDraft;

beforeEach(async () => {
  db = new VueltoDB(`test-tx-${crypto.randomUUID()}`);
  const [acc] = await db.accounts.toArray();
  const [cat] = await db.categories.toArray();
  draft = {
    type: 'expense',
    amountCents: 125000,
    currency: 'ARS',
    date: '2026-11-03',
    accountId: acc!.id,
    categoryId: cat!.id,
  };
});
afterEach(() => db.delete());

describe('transactions', () => {
  it('creates, edits and marks records as unsynced', async () => {
    const id = await saveTransaction({ ...draft, note: '  pan  ' }, undefined, db);
    let tx = await db.transactions.get(id);
    expect(tx).toMatchObject({ amountCents: 125000, note: 'pan', deleted: 0, synced: 0, tags: [] });

    await db.transactions.update(id, { synced: 1 });
    await saveTransaction({ ...draft, amountCents: 999, note: '' }, id, db);
    tx = await db.transactions.get(id);
    expect(tx).toMatchObject({ amountCents: 999, synced: 0 });
    expect(tx!.note).toBeUndefined();
    expect(tx!.updatedAt).toBeGreaterThanOrEqual(tx!.createdAt);
  });

  it('rejects non-positive or fractional amounts', async () => {
    await expect(saveTransaction({ ...draft, amountCents: 0 }, undefined, db)).rejects.toThrow();
    await expect(saveTransaction({ ...draft, amountCents: 1.5 }, undefined, db)).rejects.toThrow();
  });

  it('soft-deletes and restores', async () => {
    const id = await saveTransaction(draft, undefined, db);
    await setDeleted(id, 1, db);
    expect(await listTransactions(db)).toHaveLength(0);
    expect(await db.transactions.get(id)).toMatchObject({ deleted: 1, synced: 0 });
    await setDeleted(id, 0, db);
    expect(await listTransactions(db)).toHaveLength(1);
  });

  it('lists newest day first and newest entry first within a day', async () => {
    const a = await saveTransaction({ ...draft, date: '2026-11-02' }, undefined, db);
    const b = await saveTransaction(draft, undefined, db);
    await new Promise((r) => setTimeout(r, 2));
    const c = await saveTransaction(draft, undefined, db);
    expect((await listTransactions(db)).map((t) => t.id)).toEqual([c, b, a]);
  });
});

describe('groupByDay', () => {
  it('adds a header per day with the net total', async () => {
    await saveTransaction({ ...draft, amountCents: 1000 }, undefined, db);
    await saveTransaction({ ...draft, type: 'income', amountCents: 300 }, undefined, db);
    await saveTransaction({ ...draft, date: '2026-11-01', amountCents: 50 }, undefined, db);
    const rows = groupByDay(await listTransactions(db));
    expect(rows.map((r) => r.kind)).toEqual(['day', 'tx', 'tx', 'day', 'tx']);
    expect(rows[0]).toMatchObject({ date: '2026-11-03', totalCents: -700 });
    expect(rows[3]).toMatchObject({ date: '2026-11-01', totalCents: -50 });
  });

  it('returns nothing for no transactions', () => {
    expect(groupByDay([])).toEqual([]);
  });
});

describe('tagsOf', () => {
  it('reads #tags from the note, once each, in lowercase', () => {
    expect(tagsOf('Cena #Viaje con #amigos y #viaje')).toEqual(['viaje', 'amigos']);
    expect(tagsOf('Año #vacaciones-2027 #ñandú')).toEqual(['vacaciones-2027', 'ñandú']);
    expect(tagsOf(undefined)).toEqual([]);
  });
});

describe('splitShare', () => {
  it('rounds your part up to the cent', () => {
    expect(splitShare(1000, 4)).toBe(250);
    expect(splitShare(1000, 3)).toBe(334);
  });
});
