import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { VueltoDB } from '../../db/db';
import type { Transaction } from '../../db/types';
import { saveTransaction } from '../transactions/queries';
import {
  BackupError,
  deleteAll,
  exportBackup,
  parseBackup,
  restoreBackup,
  transactionsCsv,
} from './backup';

let db: VueltoDB;
beforeEach(() => {
  db = new VueltoDB(`test-backup-${crypto.randomUUID()}`);
});
afterEach(() => db.delete());

async function seedTx() {
  const [acc] = await db.accounts.toArray();
  const [cat] = await db.categories.toArray();
  await saveTransaction(
    {
      type: 'expense',
      amountCents: 123456,
      currency: 'ARS',
      date: '2026-11-03',
      accountId: acc!.id,
      categoryId: cat!.id,
      note: 'pan; "lactal"',
    },
    undefined,
    db,
  );
}

describe('backup', () => {
  it('round-trips everything without loss', async () => {
    await seedTx();
    await db.accounts.toCollection().modify({ synced: 1 });
    const backup = await exportBackup(db);
    // Through JSON, like a real file.
    const restored = parseBackup(JSON.parse(JSON.stringify(backup)));

    const other = new VueltoDB(`test-backup-target-${crypto.randomUUID()}`);
    await other.transactions.add({ ...(await db.transactions.toArray())[0]!, id: 'stale' });
    await restoreBackup(restored, other);
    const again = await exportBackup(other);
    expect(again.tables).toEqual(backup.tables);
    expect(await other.transactions.get('stale')).toBeUndefined();
    await other.delete();
  });

  it.each([
    [null, 'No es un backup'],
    [{ app: 'otra' }, 'No es un backup'],
    [{ app: 'vuelto', version: 2, tables: {} }, 'Versión'],
    [{ app: 'vuelto', version: 1 }, 'incompleto'],
    [{ app: 'vuelto', version: 1, tables: { transactions: {} } }, 'Tabla'],
  ])('rejects malformed backups (%#)', (input, msg) => {
    expect(() => parseBackup(input)).toThrow(msg);
  });

  it('rejects bad records with a useful message', async () => {
    await seedTx();
    const good = JSON.parse(JSON.stringify(await exportBackup(db)));
    const bad = (patch: Record<string, unknown>) => {
      const b = structuredClone(good);
      Object.assign(b.tables.transactions[0], patch);
      return () => parseBackup(b);
    };
    expect(bad({ amountCents: 12.5 })).toThrow('transactions[0]: monto inválido');
    expect(bad({ amountCents: -1 })).toThrow(BackupError);
    expect(bad({ date: '03/11/2026' })).toThrow('fecha inválida');
    expect(bad({ type: 'robo' })).toThrow('tipo inválido');
    expect(bad({ id: 42 })).toThrow('falta el id');
    const dup = structuredClone(good);
    dup.tables.categories[1].id = dup.tables.categories[0].id;
    expect(() => parseBackup(dup)).toThrow('id repetido');
  });

  it('a failed restore leaves existing data untouched', async () => {
    await seedTx();
    const backup = await exportBackup(db);
    const broken = structuredClone(backup);
    // Same id twice makes bulkAdd fail midway.
    broken.tables.accounts.push(broken.tables.accounts[0]!);
    await expect(restoreBackup(broken, db)).rejects.toThrow();
    expect(await db.transactions.count()).toBe(1);
    expect(await db.accounts.count()).toBe(4);
  });

  it('deleteAll wipes data and re-seeds defaults', async () => {
    await seedTx();
    await deleteAll(db);
    expect(await db.transactions.count()).toBe(0);
    expect(await db.categories.count()).toBe(21);
  });
});

describe('transactionsCsv', () => {
  it('uses ; and decimal comma, escapes cells, signs expenses and skips deleted', () => {
    const base = {
      createdAt: 0,
      updatedAt: 0,
      synced: 0,
      currency: 'ARS',
      tags: [] as string[],
      accountId: 'a',
    } as const;
    const txs: Transaction[] = [
      {
        ...base,
        id: '1',
        deleted: 0,
        type: 'expense',
        amountCents: 123405,
        date: '2026-11-03',
        categoryId: 'c',
        note: 'pan; "lactal"',
      },
      { ...base, id: '2', deleted: 0, type: 'income', amountCents: 5, date: '2026-11-02' },
      { ...base, id: '3', deleted: 1, type: 'income', amountCents: 9, date: '2026-11-01' },
    ];
    const csv = transactionsCsv(txs, {
      categories: new Map([['c', 'Super']]),
      accounts: new Map([['a', 'Efectivo']]),
    });
    expect(csv.startsWith('﻿Fecha;Tipo;Monto')).toBe(true);
    const lines = csv.trim().split('\r\n');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toBe('2026-11-03;Gasto;-1234,05;ARS;Super;Efectivo;;"pan; ""lactal"""');
    expect(lines[2]).toBe('2026-11-02;Ingreso;0,05;ARS;;Efectivo;;');
  });
});
