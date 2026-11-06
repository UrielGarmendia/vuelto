import type { Recurring } from '../../db/types';
import { addDays, addMonthsISO } from '../../lib/dates';
import { splitInstallments } from '../../lib/money';

/** One purchase in `n` monthly installments: the first on the purchase date, the rounding
 * remainder on the last. */
export function installmentPlan(totalCents: number, n: number, date: string) {
  return splitInstallments(totalCents, n).map((amountCents, i) => ({
    number: i + 1,
    amountCents,
    date: addMonthsISO(date, i),
  }));
}

export type Frequency = Recurring['frequency'];

/** The occurrence after `date`; monthly and yearly keep the original day (`anchor`). */
export function nextOccurrence(date: string, frequency: Frequency, anchor: number): string {
  if (frequency === 'weekly') return addDays(date, 7);
  return addMonthsISO(date, frequency === 'monthly' ? 1 : 12, anchor);
}

/** Every occurrence from `nextDate` up to `today`, plus the one after them. */
export function dueOccurrences(
  nextDate: string,
  frequency: Frequency,
  anchor: number,
  today: string,
): { due: string[]; next: string } {
  const due: string[] = [];
  let d = nextDate;
  // A cap keeps a very old rule from flooding the list in one go.
  while (d <= today && due.length < 400) {
    due.push(d);
    d = nextOccurrence(d, frequency, anchor);
  }
  return { due, next: d };
}

/** What a repeating amount costs per month (weeks average 52 a year). */
export function monthlyCost(amountCents: number, frequency: Frequency): number {
  if (frequency === 'monthly') return amountCents;
  if (frequency === 'yearly') return Math.round(amountCents / 12);
  return Math.round((amountCents * 52) / 12);
}
