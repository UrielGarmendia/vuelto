import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { saveAccount, saveCategory, saveOrder, setArchived } from './catalog';
import { VueltoDB } from './db';

let db: VueltoDB;
beforeEach(() => {
  db = new VueltoDB(`test-catalog-${crypto.randomUUID()}`);
});
afterEach(() => db.delete());

describe('catalog', () => {
  it('creates a category at the end with a cleaned name', async () => {
    const id = await saveCategory(
      { name: '  Café   y  facturas ', icon: 'coffee', color: '#D9653B', type: 'expense' },
      undefined,
      db,
    );
    const c = await db.categories.get(id);
    expect(c).toMatchObject({ name: 'Café y facturas', order: 21, archived: 0, synced: 0 });
  });

  it('rejects blank names and invalid balances', async () => {
    await expect(
      saveCategory({ name: '   ', icon: 'x', color: '#000', type: 'expense' }, undefined, db),
    ).rejects.toThrow();
    await expect(
      saveAccount(
        { name: 'X', kind: 'cash', currency: 'ARS', initialBalanceCents: 1.5, color: '#000' },
        undefined,
        db,
      ),
    ).rejects.toThrow(RangeError);
  });

  it('edits an account and marks it unsynced', async () => {
    const [acc] = await db.accounts.orderBy('order').toArray();
    await db.accounts.update(acc!.id, { synced: 1 });
    await saveAccount(
      { name: 'Caja', kind: 'cash', currency: 'ARS', initialBalanceCents: 5000, color: '#000' },
      acc!.id,
      db,
    );
    expect(await db.accounts.get(acc!.id)).toMatchObject({
      name: 'Caja',
      initialBalanceCents: 5000,
      synced: 0,
    });
  });

  it('archives and restores', async () => {
    const [cat] = await db.categories.toArray();
    await setArchived('categories', cat!.id, 1, db);
    expect((await db.categories.get(cat!.id))!.archived).toBe(1);
    await setArchived('categories', cat!.id, 0, db);
    expect((await db.categories.get(cat!.id))!.archived).toBe(0);
  });

  it('saves a new order touching only moved rows', async () => {
    const accs = await db.accounts.orderBy('order').toArray();
    await db.accounts.bulkPut(accs.map((a) => ({ ...a, synced: 1 as const })));
    const ids = accs.map((a) => a.id);
    // Swap the first two.
    await saveOrder('accounts', [ids[1]!, ids[0]!, ids[2]!, ids[3]!], db);
    const after = await db.accounts.orderBy('order').toArray();
    expect(after.map((a) => a.id)).toEqual([ids[1], ids[0], ids[2], ids[3]]);
    expect(after.map((a) => a.synced)).toEqual([0, 0, 1, 1]);
  });
});
