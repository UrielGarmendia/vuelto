import { db as defaultDb, newMeta, type VueltoDB } from './db';
import type { Account, Category } from './types';

type Table = 'categories' | 'accounts';

export type CategoryDraft = Pick<Category, 'name' | 'icon' | 'color' | 'type'>;
export type AccountDraft = Pick<
  Account,
  'name' | 'kind' | 'currency' | 'initialBalanceCents' | 'color'
>;

function cleanName(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, ' ');
  if (!trimmed) throw new Error('Name is required');
  return trimmed.slice(0, 40);
}

/** New items go last in their list. */
async function nextOrder(table: Table, db: VueltoDB): Promise<number> {
  const last = await db.table(table).orderBy('order').last();
  return last ? last.order + 1 : 0;
}

export async function saveCategory(
  draft: CategoryDraft,
  id?: string,
  db: VueltoDB = defaultDb,
): Promise<string> {
  const data = { ...draft, name: cleanName(draft.name) };
  if (id) {
    await db.categories.update(id, { ...data, updatedAt: Date.now(), synced: 0 });
    return id;
  }
  const c: Category = {
    ...newMeta(),
    ...data,
    order: await nextOrder('categories', db),
    archived: 0,
  };
  await db.categories.add(c);
  return c.id;
}

export async function saveAccount(
  draft: AccountDraft,
  id?: string,
  db: VueltoDB = defaultDb,
): Promise<string> {
  if (!Number.isSafeInteger(draft.initialBalanceCents)) throw new RangeError('Invalid balance');
  const data = { ...draft, name: cleanName(draft.name) };
  if (id) {
    await db.accounts.update(id, { ...data, updatedAt: Date.now(), synced: 0 });
    return id;
  }
  const a: Account = { ...newMeta(), ...data, order: await nextOrder('accounts', db), archived: 0 };
  await db.accounts.add(a);
  return a.id;
}

/** Archived items disappear from pickers but keep their history. */
export function setArchived(table: Table, id: string, archived: 0 | 1, db: VueltoDB = defaultDb) {
  return db.table(table).update(id, { archived, updatedAt: Date.now(), synced: 0 });
}

/** Persists a new order; only rows whose position changed are touched (and re-synced). */
export async function saveOrder(table: Table, ids: readonly string[], db: VueltoDB = defaultDb) {
  const now = Date.now();
  await db.transaction('rw', db.table(table), async () => {
    const rows = await db.table(table).bulkGet([...ids]);
    const changed = rows.flatMap((row, order) =>
      row && row.order !== order ? [{ ...row, order, updatedAt: now, synced: 0 }] : [],
    );
    await db.table(table).bulkPut(changed);
  });
}
