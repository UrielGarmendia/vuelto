import { db as defaultDb, type VueltoDB } from '../../db/db';
import type { Transaction } from '../../db/types';

// Tables added later (templates) are optional, so older backups still restore.
const TABLES = [
  'transactions',
  'categories',
  'accounts',
  'budgets',
  'recurring',
  'goals',
  'templates',
] as const;
type TableName = (typeof TABLES)[number];

export interface Backup {
  app: 'vuelto';
  version: 1;
  exportedAt: string;
  tables: Record<TableName, Record<string, unknown>[]>;
}

// Receipt photos (blobs) and per-device state (kv) are not part of the backup.
export async function exportBackup(db: VueltoDB = defaultDb): Promise<Backup> {
  const tables = {} as Backup['tables'];
  for (const t of TABLES) tables[t] = await db.table(t).toArray();
  return { app: 'vuelto', version: 1, exportedAt: new Date().toISOString(), tables };
}

export class BackupError extends Error {}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isInt = (v: unknown) => Number.isSafeInteger(v);
const isDate = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const is01 = (v: unknown) => v === 0 || v === 1;

function checkMeta(r: Record<string, unknown>, where: string) {
  if (typeof r.id !== 'string' || !r.id) throw new BackupError(`${where}: falta el id`);
  if (!isInt(r.createdAt) || !isInt(r.updatedAt) || !is01(r.deleted) || !is01(r.synced))
    throw new BackupError(`${where}: metadatos inválidos`);
}

/** Validates untrusted JSON before anything touches the database. */
export function parseBackup(input: unknown): Backup {
  if (!isObj(input) || input.app !== 'vuelto') throw new BackupError('No es un backup de Vuelto');
  if (input.version !== 1) throw new BackupError('Versión de backup no soportada');
  if (!isObj(input.tables)) throw new BackupError('Backup incompleto');
  const tables = input.tables;
  for (const t of TABLES) {
    const rows = tables[t] ?? [];
    if (!Array.isArray(rows)) throw new BackupError(`Tabla ${t} inválida`);
    tables[t] = rows;
    const ids = new Set<string>();
    rows.forEach((r, i) => {
      const where = `${t}[${i}]`;
      if (!isObj(r)) throw new BackupError(`${where}: registro inválido`);
      checkMeta(r, where);
      if (ids.has(r.id as string)) throw new BackupError(`${where}: id repetido`);
      ids.add(r.id as string);
      if (t === 'transactions') {
        if (!['expense', 'income', 'transfer'].includes(r.type as string))
          throw new BackupError(`${where}: tipo inválido`);
        if (!isInt(r.amountCents) || (r.amountCents as number) <= 0)
          throw new BackupError(`${where}: monto inválido`);
        if (!isDate(r.date)) throw new BackupError(`${where}: fecha inválida`);
        if (typeof r.accountId !== 'string') throw new BackupError(`${where}: falta la cuenta`);
        if (!['ARS', 'USD'].includes(r.currency as string))
          throw new BackupError(`${where}: moneda inválida`);
        if (!Array.isArray(r.tags)) throw new BackupError(`${where}: etiquetas inválidas`);
      }
      if ((t === 'categories' || t === 'accounts') && typeof r.name !== 'string')
        throw new BackupError(`${where}: falta el nombre`);
      if (t === 'accounts' && !isInt(r.initialBalanceCents))
        throw new BackupError(`${where}: saldo inicial inválido`);
    });
  }
  return input as unknown as Backup;
}

/** Replaces all synced data with the backup, atomically: either everything lands or nothing. */
export async function restoreBackup(backup: Backup, db: VueltoDB = defaultDb): Promise<void> {
  await db.transaction(
    'rw',
    TABLES.map((t) => db.table(t)),
    async () => {
      for (const t of TABLES) {
        await db.table(t).clear();
        await db.table(t).bulkAdd(backup.tables[t]);
      }
    },
  );
}

/** Wipes everything and re-seeds the default categories and accounts. */
export async function deleteAll(db: VueltoDB = defaultDb): Promise<void> {
  await db.delete();
  await db.open();
}

const csvCell = (v: string) => (/[";\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/**
 * Transactions as CSV for spreadsheets set to es-AR: `;` separator and decimal comma,
 * with a BOM so Excel reads the accents right.
 */
export function transactionsCsv(
  txs: readonly Transaction[],
  names: { categories: Map<string, string>; accounts: Map<string, string> },
): string {
  const type = { expense: 'Gasto', income: 'Ingreso', transfer: 'Transferencia' };
  const header = [
    'Fecha',
    'Tipo',
    'Monto',
    'Moneda',
    'Categoría',
    'Cuenta',
    'Cuenta destino',
    'Nota',
  ];
  const lines = txs
    .filter((t) => !t.deleted)
    .map((t) => {
      const abs = t.amountCents;
      const amount = `${Math.trunc(abs / 100)},${String(abs % 100).padStart(2, '0')}`;
      return [
        t.date,
        type[t.type],
        t.type === 'expense' ? `-${amount}` : amount,
        t.currency,
        (t.categoryId && names.categories.get(t.categoryId)) || '',
        names.accounts.get(t.accountId) ?? '',
        (t.toAccountId && names.accounts.get(t.toAccountId)) || '',
        t.note ?? '',
      ]
        .map(csvCell)
        .join(';');
    });
  return '﻿' + [header.join(';'), ...lines].join('\r\n') + '\r\n';
}

export function download(filename: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
