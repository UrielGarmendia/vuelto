import { db as defaultDb, newMeta, type VueltoDB } from '../../db/db';
import type { Transaction } from '../../db/types';

export type TxDraft = Pick<
  Transaction,
  'type' | 'amountCents' | 'currency' | 'date' | 'categoryId' | 'accountId' | 'note'
>;

export async function saveTransaction(
  draft: TxDraft,
  id?: string,
  db: VueltoDB = defaultDb,
): Promise<string> {
  if (!Number.isSafeInteger(draft.amountCents) || draft.amountCents <= 0) {
    throw new RangeError('Amount must be a positive integer of cents');
  }
  const note = draft.note?.trim() || undefined;
  if (id) {
    await db.transactions.update(id, { ...draft, note, updatedAt: Date.now(), synced: 0 });
    return id;
  }
  const tx: Transaction = { ...newMeta(), ...draft, note, tags: [] };
  await db.transactions.add(tx);
  return tx.id;
}

export function setDeleted(id: string, deleted: 0 | 1, db: VueltoDB = defaultDb) {
  return db.transactions.update(id, { deleted, updatedAt: Date.now(), synced: 0 });
}

/** Newest first; ties broken by creation time so fresh entries sit on top of their day. */
export async function listTransactions(db: VueltoDB = defaultDb): Promise<Transaction[]> {
  const all = await db.transactions.where('deleted').equals(0).toArray();
  return all.sort((a, b) =>
    a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1,
  );
}

export function signedCents(tx: Pick<Transaction, 'type' | 'amountCents'>): number {
  if (tx.type === 'income') return tx.amountCents;
  if (tx.type === 'expense') return -tx.amountCents;
  return 0; // transfers don't change the net
}

export type ListRow =
  | { kind: 'day'; key: string; date: string; totalCents: number }
  | { kind: 'tx'; key: string; tx: Transaction };

/** Flattens sorted transactions into day headers + rows for the virtual list. */
export function groupByDay(txs: readonly Transaction[]): ListRow[] {
  const rows: ListRow[] = [];
  let header: Extract<ListRow, { kind: 'day' }> | undefined;
  for (const tx of txs) {
    if (header?.date !== tx.date) {
      header = { kind: 'day', key: `day-${tx.date}`, date: tx.date, totalCents: 0 };
      rows.push(header);
    }
    header.totalCents += signedCents(tx);
    rows.push({ kind: 'tx', key: tx.id, tx });
  }
  return rows;
}
