import { create } from 'zustand';
import type { Category, Transaction } from '../../db/types';
import { addDays } from '../../lib/dates';

export type Range = 'all' | 'month' | 'last-month' | '30d';

export interface Filters {
  query: string;
  range: Range;
  type?: 'expense' | 'income';
  categoryId?: string;
  accountId?: string;
}

export const emptyFilters: Filters = { query: '', range: 'all' };

export const useFilters = create<
  Filters & { set: (p: Partial<Filters>) => void; reset: () => void }
>()((set) => ({
  ...emptyFilters,
  set: (p) => set(p),
  reset: () =>
    set({ ...emptyFilters, type: undefined, categoryId: undefined, accountId: undefined }),
}));

export function isFiltering(f: Filters): boolean {
  return !!(f.query.trim() || f.range !== 'all' || f.type || f.categoryId || f.accountId);
}

// Case- and accent-insensitive, so "credito" finds "Crédito".
const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

function rangeBounds(range: Range, today: string): [string, string] | null {
  const month = today.slice(0, 7);
  if (range === 'month') return [`${month}-01`, today];
  if (range === '30d') return [addDays(today, -29), today];
  if (range === 'last-month') {
    const lastDay = addDays(`${month}-01`, -1);
    return [`${lastDay.slice(0, 7)}-01`, lastDay];
  }
  return null;
}

export function filterTransactions(
  txs: readonly Transaction[],
  f: Filters,
  categories: Map<string, Category>,
  today: string,
): Transaction[] {
  const bounds = rangeBounds(f.range, today);
  const q = fold(f.query.trim());
  return txs.filter((tx) => {
    if (bounds && (tx.date < bounds[0] || tx.date > bounds[1])) return false;
    if (f.type && tx.type !== f.type) return false;
    if (f.categoryId && tx.categoryId !== f.categoryId) return false;
    if (f.accountId && tx.accountId !== f.accountId && tx.toAccountId !== f.accountId) return false;
    if (!q) return true;
    const cat = tx.categoryId ? categories.get(tx.categoryId)?.name : '';
    // Amounts match by their digits, so "1250" finds $ 1.250 and $ 12,50.
    const haystack = fold(`${tx.note ?? ''} ${cat ?? ''} ${tx.amountCents}`);
    return haystack.includes(q.replace(/[.,$\s]/g, '')) || haystack.includes(q);
  });
}
