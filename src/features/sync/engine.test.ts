import { afterEach, describe, expect, it } from 'vitest';
import { VueltoDB } from '../../db/db';
import { saveTransaction, setDeleted } from '../transactions/queries';
import type { Drive, DriveFile } from './drive';
import { syncAll } from './engine';

/** Drive in memory: files with a version that grows on every write. */
function fakeDrive() {
  const files = new Map<string, DriveFile & { body: string }>();
  let writes = 0;
  const drive: Drive = {
    list: async () => [...files.values()].map(({ id, name, version }) => ({ id, name, version })),
    read: async (id) => JSON.parse(files.get(id)!.body),
    version: async (id) => files.get(id)!.version,
    create: async (name, content) => {
      const f = { id: crypto.randomUUID(), name, version: '1', body: JSON.stringify(content) };
      files.set(f.id, f);
      writes++;
      return f;
    },
    update: async (id, content) => {
      const f = files.get(id)!;
      f.version = String(Number(f.version) + 1);
      f.body = JSON.stringify(content);
      writes++;
      return f;
    },
  };
  return { drive, files, writes: () => writes };
}

const dbs: VueltoDB[] = [];
async function device() {
  const db = new VueltoDB(`sync-${crypto.randomUUID()}`);
  await db.open();
  dbs.push(db);
  return db;
}
afterEach(async () => {
  await Promise.all(dbs.splice(0).map((d) => d.delete()));
});

const expense = async (db: VueltoDB, note: string, date = '2026-11-05') => {
  const accountId = (await db.accounts.toCollection().first())!.id;
  return saveTransaction(
    { type: 'expense', amountCents: 1000, currency: 'ARS', date, accountId, note },
    undefined,
    db,
  );
};
const notes = async (db: VueltoDB) =>
  (await db.transactions.where('deleted').equals(0).toArray()).map((t) => t.note).sort();

describe('syncAll', () => {
  it('brings two devices to the same data, one file per year', async () => {
    const { drive, files } = fakeDrive();
    const a = await device();
    const b = await device();
    await expense(a, 'café', '2025-12-30');
    await expense(a, 'super');
    await syncAll(drive, a);
    expect([...files.values()].map((f) => f.name).sort()).toEqual([
      'vuelto-catalog.json',
      'vuelto-tx-2025.json',
      'vuelto-tx-2026.json',
    ]);

    await syncAll(drive, b);
    expect(await notes(b)).toEqual(['café', 'super']);
    // B joined A's catalog instead of keeping a second copy of every default.
    expect(await b.categories.count()).toBe(await a.categories.count());

    await expense(b, 'nafta');
    const coffee = (await b.transactions.toArray()).find((t) => t.note === 'café')!;
    await setDeleted(coffee.id, 1, b);
    await expense(a, 'cine');
    await syncAll(drive, b);
    await syncAll(drive, a);
    await syncAll(drive, b);
    expect(await notes(a)).toEqual(['cine', 'nafta', 'super']);
    expect(await notes(b)).toEqual(await notes(a));
  });

  it('does nothing when neither side changed', async () => {
    const { drive, writes } = fakeDrive();
    const a = await device();
    await expense(a, 'café');
    await syncAll(drive, a);
    const before = writes();
    expect((await syncAll(drive, a)).files).toBe(0);
    expect(writes()).toBe(before);
  });

  it('keeps a local edit made while the sync was running', async () => {
    const { drive } = fakeDrive();
    const a = await device();
    const id = await expense(a, 'café');
    await syncAll(drive, a);
    const slow: Drive = {
      ...drive,
      read: async (fileId) => {
        const body = await drive.read(fileId);
        await a.transactions.update(id, {
          note: 'editado',
          updatedAt: Date.now() + 1000,
          synced: 0,
        });
        return body;
      },
    };
    await a.transactions.update(id, { note: 'cambio', updatedAt: Date.now(), synced: 0 });
    await syncAll(slow, a);
    expect((await a.transactions.get(id))!.note).toBe('editado');
    expect((await a.transactions.get(id))!.synced).toBe(0);
  });
});
