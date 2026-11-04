import { describe, expect, it } from 'vitest';
import type { Category, Transaction } from '../../db/types';
import { emptyFilters, filterTransactions, isFiltering, type Filters } from './filters';

const meta = { createdAt: 0, updatedAt: 0, deleted: 0, synced: 0 } as const;
const cat = (id: string, name: string): Category => ({
  ...meta,
  id,
  name,
  icon: '',
  color: '',
  type: 'expense',
  order: 0,
  archived: 0,
});
const categories = new Map([
  ['super', cat('super', 'Supermercado')],
  ['edu', cat('edu', 'Educación')],
]);

const tx = (id: string, p: Partial<Transaction>): Transaction => ({
  ...meta,
  id,
  type: 'expense',
  amountCents: 1000,
  currency: 'ARS',
  date: '2026-11-03',
  accountId: 'cash',
  tags: [],
  ...p,
});

const txs = [
  tx('a', { categoryId: 'super', note: 'Chino de la esquina', amountCents: 125000 }),
  tx('b', { categoryId: 'edu', date: '2026-10-15', accountId: 'bank' }),
  tx('c', { type: 'income', date: '2026-10-31', amountCents: 50000000 }),
  tx('d', { date: '2026-09-01', type: 'transfer', accountId: 'bank', toAccountId: 'cash' }),
];

const run = (f: Partial<Filters>) =>
  filterTransactions(txs, { ...emptyFilters, ...f }, categories, '2026-11-03').map((t) => t.id);

describe('filterTransactions', () => {
  it('returns everything without filters', () => {
    expect(run({})).toEqual(['a', 'b', 'c', 'd']);
    expect(isFiltering(emptyFilters)).toBe(false);
  });

  it('filters by date range', () => {
    expect(run({ range: 'month' })).toEqual(['a']);
    expect(run({ range: 'last-month' })).toEqual(['b', 'c']);
    expect(run({ range: '30d' })).toEqual(['a', 'b', 'c']); // 5 Oct … 3 Nov
  });

  it('handles last month across a year boundary', () => {
    const jan = filterTransactions(
      [tx('x', { date: '2025-12-31' }), tx('y', { date: '2026-01-02' })],
      { ...emptyFilters, range: 'last-month' },
      categories,
      '2026-01-10',
    );
    expect(jan.map((t) => t.id)).toEqual(['x']);
  });

  it('filters by type, category and account (transfers match both ends)', () => {
    expect(run({ type: 'income' })).toEqual(['c']);
    expect(run({ categoryId: 'edu' })).toEqual(['b']);
    expect(run({ accountId: 'cash' })).toEqual(['a', 'c', 'd']);
  });

  it('searches notes and category names ignoring case and accents', () => {
    expect(run({ query: 'CHINO' })).toEqual(['a']);
    expect(run({ query: 'educacion' })).toEqual(['b']);
  });

  it('searches amounts by digits', () => {
    expect(run({ query: '1.250' })).toEqual(['a']);
    expect(run({ query: '$ 500.000' })).toEqual(['c']);
  });

  it('combines filters', () => {
    expect(run({ range: 'last-month', type: 'expense' })).toEqual(['b']);
    expect(isFiltering({ ...emptyFilters, query: '  ' })).toBe(false);
  });
});
