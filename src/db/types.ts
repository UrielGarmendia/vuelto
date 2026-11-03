import type { Currency } from '../lib/money';

export interface Meta {
  id: string;
  createdAt: number;
  updatedAt: number;
  deleted: 0 | 1;
  synced: 0 | 1;
}

export type TxType = 'expense' | 'income' | 'transfer';

export interface Transaction extends Meta {
  type: TxType;
  /** Always positive; the sign comes from `type`. */
  amountCents: number;
  currency: Currency;
  /** ARS per 1 unit of `currency` on the transaction date, for non-base currencies. */
  rateAtDate?: number;
  date: string; // YYYY-MM-DD
  categoryId?: string;
  accountId: string;
  toAccountId?: string;
  note?: string;
  tags: string[];
  installment?: { groupId: string; number: number; total: number };
  recurringId?: string;
  receiptBlobId?: string;
}

export interface Category extends Meta {
  name: string;
  icon: string; // lucide icon name
  color: string;
  type: 'expense' | 'income';
  order: number;
  archived: 0 | 1;
}

export type AccountKind = 'cash' | 'bank' | 'wallet' | 'credit';

export interface Account extends Meta {
  name: string;
  kind: AccountKind;
  currency: Currency;
  initialBalanceCents: number;
  color: string;
  order: number;
  archived: 0 | 1;
}

export interface Budget extends Meta {
  categoryId: string;
  month: string; // YYYY-MM
  amountCents: number;
}

export interface Recurring extends Meta {
  template: Partial<Transaction>;
  frequency: 'weekly' | 'monthly' | 'yearly';
  nextDate: string;
  active: 0 | 1;
}

export interface Goal extends Meta {
  name: string;
  targetCents: number;
  savedCents: number;
  color: string;
  deadline?: string;
}

export interface StoredBlob {
  id: string;
  blob: Blob;
}

export interface KV {
  key: string;
  value: unknown;
}
