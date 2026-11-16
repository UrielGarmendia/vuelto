import type { Account } from '../../db/types';
import { amountInputToCents, centsToAmountInput } from '../../lib/amountInput';
import type { CopilotDraft } from './parse';

/** A card being reviewed: the draft as the user edits it. */
export interface Card extends CopilotDraft {
  key: string;
  amount: string;
  /** The category the reading proposed, to notice a correction. */
  proposedCategoryId?: string;
  /** A photo to keep with the movement (from a receipt). */
  photo?: Blob;
}

export const toCard = (d: CopilotDraft): Card => ({
  ...d,
  key: crypto.randomUUID(),
  amount: d.amountCents ? centsToAmountInput(d.amountCents) : '',
  proposedCategoryId: d.categoryId,
});

/** What still stops a card from being saved, in words for the user. */
export function problems(c: Card, accounts: Account[]): string[] {
  const out: string[] = [];
  const account = accounts.find((a) => a.id === c.accountId);
  if (amountInputToCents(c.amount) <= 0) out.push('el monto');
  if (!account) out.push(c.currency === 'USD' ? 'una cuenta en dólares' : 'la cuenta');
  else if (c.currency === 'USD' && account.currency !== 'USD') out.push('una cuenta en dólares');
  if (c.type === 'transfer') {
    const to = accounts.find((a) => a.id === c.toAccountId);
    if (!to || to.id === account?.id || to.currency !== account?.currency)
      out.push('la cuenta destino');
  } else if (!c.categoryId) out.push('la categoría');
  return out;
}
