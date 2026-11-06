import { db as defaultDb, newMeta, type VueltoDB } from '../../db/db';
import { fromISODate } from '../../lib/dates';
import type { Recurring, Transaction } from '../../db/types';
import { saveTransaction, tagsOf, type TxDraft } from './queries';
import { dueOccurrences, installmentPlan, nextOccurrence, type Frequency } from './schedule';

export interface CreateOptions {
  /** More than 1 splits an expense into monthly installments. */
  installments?: number;
  /** Repeats the movement from its date on. */
  repeat?: Frequency;
}

const clean = (draft: TxDraft) => ({
  ...draft,
  note: draft.note?.trim() || undefined,
  categoryId: draft.type === 'transfer' ? undefined : draft.categoryId,
  toAccountId: draft.type === 'transfer' ? draft.toAccountId : undefined,
});

/** New movement, its installments, or the first of a repeating series. */
export async function createTransaction(
  draft: TxDraft,
  { installments = 1, repeat }: CreateOptions = {},
  db: VueltoDB = defaultDb,
): Promise<void> {
  if (installments > 1 && draft.type === 'expense') {
    const groupId = crypto.randomUUID();
    const plan = installmentPlan(draft.amountCents, installments, draft.date);
    await db.transactions.bulkAdd(
      plan.map((p) => ({
        ...newMeta(),
        ...clean(draft),
        amountCents: p.amountCents,
        date: p.date,
        tags: tagsOf(draft.note),
        installment: { groupId, number: p.number, total: installments },
      })),
    );
    return;
  }
  if (repeat) {
    const anchorDay = Number(draft.date.slice(8));
    const rule: Recurring = {
      ...newMeta(),
      template: clean(draft),
      frequency: repeat,
      nextDate: nextOccurrence(draft.date, repeat, anchorDay),
      anchorDay,
      active: 1,
    };
    await db.transaction('rw', db.recurring, db.transactions, async () => {
      await db.recurring.add(rule);
      await db.transactions.add({
        ...newMeta(),
        id: occurrenceId(rule.id, draft.date),
        ...clean(draft),
        tags: tagsOf(draft.note),
        recurringId: rule.id,
      });
    });
    return;
  }
  await saveTransaction(draft, undefined, db);
}

/** One id per rule and date, the same on every device. */
export const occurrenceId = (ruleId: string, date: string) => `${ruleId}:${date}`;

/** Creates the movements of every active rule that came due; runs when the app opens. */
export async function runRecurring(today: string, db: VueltoDB = defaultDb): Promise<number> {
  return db.transaction('rw', db.recurring, db.transactions, async () => {
    const rules = await db.recurring.where('nextDate').belowOrEqual(today).toArray();
    let created = 0;
    for (const r of rules) {
      if (!r.active || r.deleted) continue;
      const anchor = r.anchorDay ?? Number(r.nextDate.slice(8));
      const { due, next } = dueOccurrences(r.nextDate, r.frequency, anchor, today);
      const rows: Transaction[] = due.map((date) => ({
        ...(r.template as Omit<Transaction, keyof ReturnType<typeof newMeta>>),
        // Same id and an old timestamp on every device: copies made before a sync collapse
        // into one, and any real edit or deletion of the occurrence wins over them.
        ...newMeta(fromISODate(date).getTime()),
        id: occurrenceId(r.id, date),
        date,
        tags: tagsOf(r.template.note),
        recurringId: r.id,
      }));
      const existing = new Set(
        (await db.transactions.bulkGet(rows.map((t) => t.id))).filter(Boolean).map((t) => t!.id),
      );
      const fresh = rows.filter((t) => !existing.has(t.id));
      await db.transactions.bulkAdd(fresh);
      await db.recurring.update(r.id, { nextDate: next, updatedAt: Date.now(), synced: 0 });
      created += fresh.length;
    }
    return created;
  });
}

/** Soft-deletes (or restores) every installment of a purchase. */
export async function setGroupDeleted(groupId: string, deleted: 0 | 1, db: VueltoDB = defaultDb) {
  const now = Date.now();
  await db.transactions
    .where('installment.groupId')
    .equals(groupId)
    .modify({ deleted, updatedAt: now, synced: 0 });
}

/** Applies category, account and note to every installment of a purchase. */
export async function updateGroup(
  groupId: string,
  changes: Pick<Transaction, 'categoryId' | 'accountId' | 'note'>,
  db: VueltoDB = defaultDb,
) {
  await db.transactions
    .where('installment.groupId')
    .equals(groupId)
    .modify({
      ...changes,
      note: changes.note?.trim() || undefined,
      updatedAt: Date.now(),
      synced: 0,
    });
}
