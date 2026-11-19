import type { Recurring, Transaction } from '../../db/types';
import { arsCents } from '../../lib/money';
import { dueOccurrences } from '../transactions/schedule';
import { daysInMonth } from './summary';

export interface Surplus {
  incomeCents: number;
  expenseCents: number;
  /** Repeating movements still to come this month: income adds, expense takes away. */
  pendingCents: number;
  /** income − expense + pending: what is left this month. */
  surplusCents: number;
}

/**
 * What this month leaves over: income minus spending so far, minus the repeating expenses
 * (plus the repeating income) still due before the month ends. Information only.
 */
export function monthSurplus(
  txs: readonly Transaction[],
  rules: readonly Recurring[],
  today: string,
): Surplus {
  const month = today.slice(0, 7);
  let incomeCents = 0;
  let expenseCents = 0;
  for (const tx of txs) {
    if (tx.deleted || !tx.date.startsWith(month)) continue;
    if (tx.type === 'income') incomeCents += arsCents(tx);
    else if (tx.type === 'expense') expenseCents += arsCents(tx);
  }
  const monthEnd = `${month}-${String(daysInMonth(month)).padStart(2, '0')}`;
  let pendingCents = 0;
  for (const r of rules) {
    const t = r.template;
    if (!r.active || r.deleted || !t.amountCents || (t.type !== 'income' && t.type !== 'expense'))
      continue;
    const anchor = r.anchorDay ?? Number(r.nextDate.slice(8));
    const coming = dueOccurrences(r.nextDate, r.frequency, anchor, monthEnd).due.filter(
      (d) => d > today,
    );
    const each = arsCents({
      amountCents: t.amountCents,
      currency: t.currency ?? 'ARS',
      rateAtDate: t.rateAtDate,
    });
    pendingCents += (t.type === 'income' ? 1 : -1) * each * coming.length;
  }
  return {
    incomeCents,
    expenseCents,
    pendingCents,
    surplusCents: incomeCents - expenseCents + pendingCents,
  };
}
