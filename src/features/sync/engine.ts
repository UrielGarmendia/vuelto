import { db as defaultDb, type VueltoDB } from '../../db/db';
import type { Meta } from '../../db/types';
import type { Drive, DriveFile } from './drive';
import { mergeRecords } from './merge';

/** Catalog tables travel together in one file; movements go in one file per year. */
export const CATALOG_TABLES = [
  'categories',
  'accounts',
  'budgets',
  'recurring',
  'goals',
  'templates',
] as const;
const CATALOG_FILE = 'vuelto-catalog.json';
const yearFile = (year: string) => `vuelto-tx-${year}.json`;

type Row = Meta & Record<string, unknown>;
type Tables = Record<string, Row[]>;

const strip = (r: Row) =>
  Object.fromEntries(Object.entries(r).filter(([k]) => k !== 'synced')) as Row;

/** Reads a file body defensively: anything that is not ours counts as empty. */
function tablesOf(body: unknown, names: readonly string[]): Tables {
  const out: Tables = Object.fromEntries(names.map((n) => [n, []]));
  if (typeof body !== 'object' || body === null || (body as { app?: unknown }).app !== 'vuelto')
    return out;
  const tables = (body as { tables?: unknown }).tables;
  if (typeof tables !== 'object' || tables === null) return out;
  for (const n of names) {
    const rows = (tables as Record<string, unknown>)[n];
    if (Array.isArray(rows))
      out[n] = rows.filter(
        (r): r is Row =>
          typeof r === 'object' &&
          r !== null &&
          typeof (r as Row).id === 'string' &&
          typeof (r as Row).updatedAt === 'number',
      );
  }
  return out;
}

async function localTables(db: VueltoDB, file: string): Promise<Tables> {
  if (file === CATALOG_FILE) {
    const out: Tables = {};
    for (const t of CATALOG_TABLES) out[t] = (await db.table(t).toArray()) as Row[];
    return out;
  }
  const year = file.slice(10, 14);
  return {
    transactions: (await db.transactions
      .where('date')
      .between(`${year}-01-01`, `${year}-12-31`, true, true)
      .toArray()) as unknown as Row[],
  };
}

/** Stores merged rows unless the local copy changed while the sync was in flight. */
async function apply(db: VueltoDB, merged: Tables) {
  const names = Object.keys(merged);
  await db.transaction('rw', names, async () => {
    for (const name of names) {
      const table = db.table(name);
      const rows = merged[name]!;
      const current = new Map(
        ((await table.bulkGet(rows.map((r) => r.id))) as (Row | undefined)[])
          .filter((r): r is Row => !!r)
          .map((r) => [r.id, r]),
      );
      await table.bulkPut(
        rows
          .filter((r) => (current.get(r.id)?.updatedAt ?? -1) <= r.updatedAt)
          .map((r) => ({ ...r, synced: 1 })),
      );
    }
  });
}

const same = (a: Tables, b: Tables) => JSON.stringify(a) === JSON.stringify(b);

/** Merge one file with the device, upload if the device had something new, and retry if
 * another device wrote the file in the meantime. */
async function syncFile(drive: Drive, db: VueltoDB, name: string, remote?: DriveFile) {
  let file = remote;
  for (let attempt = 0; attempt < 3; attempt++) {
    const local = await localTables(db, name);
    const names = Object.keys(local);
    const theirs = file ? tablesOf(await drive.read(file.id), names) : tablesOf(null, names);
    const merged: Tables = Object.fromEntries(
      names.map((n) => [n, mergeRecords(local[n]!.map(strip), theirs[n]!)]),
    );
    await apply(db, merged);
    if (file && same(merged, theirs)) return file.version;
    const body = { app: 'vuelto', version: 1, tables: merged };
    if (!file) return (await drive.create(name, body)).version;
    // Someone wrote since we read: start over with their version.
    if ((await drive.version(file.id)) !== file.version) {
      file = { ...file, version: await drive.version(file.id) };
      continue;
    }
    return (await drive.update(file.id, body)).version;
  }
  throw new Error(`${name} kept changing on another device`);
}

/**
 * A new device seeds its own default categories and accounts. Joining an existing account,
 * the untouched, unused ones that Drive already has under the same name are dropped, so the
 * catalog does not show every default twice.
 */
async function dropDuplicateSeeds(drive: Drive, db: VueltoDB, file: DriveFile) {
  const theirs = tablesOf(await drive.read(file.id), ['categories', 'accounts']);
  const used = new Set<string>();
  await db.transactions.each((t) => {
    if (t.categoryId) used.add(t.categoryId);
    used.add(t.accountId);
    if (t.toAccountId) used.add(t.toAccountId);
  });
  for (const name of ['categories', 'accounts'] as const) {
    const names = new Set(theirs[name]!.map((r) => `${r.name}|${r.type ?? ''}`));
    const local = (await db.table(name).toArray()) as Row[];
    const drop = local.filter(
      (r) =>
        !r.synced &&
        r.createdAt === r.updatedAt &&
        !used.has(r.id) &&
        names.has(`${r.name}|${r.type ?? ''}`),
    );
    await db.table(name).bulkDelete(drop.map((r) => r.id));
  }
}

export interface SyncResult {
  files: number;
}

/** One full round: every file that changed remotely or has local changes. */
export async function syncAll(drive: Drive, db: VueltoDB = defaultDb): Promise<SyncResult> {
  const remote = new Map((await drive.list()).map((f) => [f.name, f]));
  const known = ((await db.kv.get('sync-versions'))?.value ?? {}) as Record<string, string>;
  const years = new Set<string>();
  await db.transactions.each((t) => {
    if (!t.synced || !remote.has(yearFile(t.date.slice(0, 4)))) years.add(t.date.slice(0, 4));
  });
  for (const name of remote.keys()) {
    const m = /^vuelto-tx-(\d{4})\.json$/.exec(name);
    if (m) years.add(m[1]!);
  }
  let catalogDirty = false;
  for (const t of CATALOG_TABLES)
    if ((await db.table(t).where('synced').equals(0).count()) > 0) catalogDirty = true;

  const remoteCatalog = remote.get(CATALOG_FILE);
  if (remoteCatalog && !known[CATALOG_FILE]) await dropDuplicateSeeds(drive, db, remoteCatalog);

  const files = [CATALOG_FILE, ...[...years].sort().map(yearFile)];
  const versions = { ...known };
  let touched = 0;
  for (const name of files) {
    const r = remote.get(name);
    const dirty =
      name === CATALOG_FILE
        ? catalogDirty
        : (await db.transactions
            .where('date')
            .between(`${name.slice(10, 14)}-01-01`, `${name.slice(10, 14)}-12-31`, true, true)
            .filter((t) => !t.synced)
            .count()) > 0;
    if (r && !dirty && known[name] === r.version) continue;
    versions[name] = await syncFile(drive, db, name, r);
    touched++;
  }
  await db.kv.put({ key: 'sync-versions', value: versions });
  return { files: touched };
}
