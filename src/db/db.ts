import { Dexie, type EntityTable } from 'dexie';
import type {
  Account,
  Budget,
  Category,
  Goal,
  KV,
  Meta,
  Recurring,
  StoredBlob,
  Transaction,
} from './types';
import { seed } from './seed';

export class VueltoDB extends Dexie {
  transactions!: EntityTable<Transaction, 'id'>;
  categories!: EntityTable<Category, 'id'>;
  accounts!: EntityTable<Account, 'id'>;
  budgets!: EntityTable<Budget, 'id'>;
  recurring!: EntityTable<Recurring, 'id'>;
  goals!: EntityTable<Goal, 'id'>;
  blobs!: EntityTable<StoredBlob, 'id'>;
  kv!: EntityTable<KV, 'key'>;

  constructor(name = 'vuelto') {
    super(name);
    this.version(1).stores({
      transactions:
        'id, date, type, [accountId+date], [categoryId+date], toAccountId, installment.groupId, recurringId, synced, updatedAt, deleted',
      categories: 'id, type, order, synced, updatedAt',
      accounts: 'id, order, synced, updatedAt',
      budgets: 'id, [categoryId+month], month, synced, updatedAt',
      recurring: 'id, nextDate, active, synced, updatedAt',
      goals: 'id, synced, updatedAt',
      blobs: 'id',
      kv: 'key',
    });
    this.on('populate', (tx) => seed(tx));
  }
}

export const db = new VueltoDB();

export function newMeta(now = Date.now()): Meta {
  return { id: crypto.randomUUID(), createdAt: now, updatedAt: now, deleted: 0, synced: 0 };
}

/** Asks the browser not to evict our data; stores the outcome for Settings. */
export async function requestPersistentStorage(): Promise<boolean> {
  const persisted = (await navigator.storage?.persist?.()) ?? false;
  await db.kv.put({ key: 'storagePersisted', value: persisted });
  return persisted;
}
