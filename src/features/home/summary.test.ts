import { describe, expect, it } from 'vitest';
import type { Account, Transaction } from '../../db/types';
import { accountBalances, dailySpending, monthTotals, topCategories, totals } from './summary';

const meta = { createdAt: 0, updatedAt: 0, deleted: 0, synced: 0 } as const;

function acc(
  id: string,
  kind: Account['kind'],
  initial = 0,
  currency: Account['currency'] = 'ARS',
): Account {
  return {
    ...meta,
    id,
    name: id,
    kind,
    currency,
    initialBalanceCents: initial,
    color: '',
    order: 0,
    archived: 0,
  };
}

let n = 0;
function tx(
  p: Partial<Transaction> & Pick<Transaction, 'type' | 'amountCents' | 'accountId'>,
): Transaction {
  return { ...meta, id: `t${n++}`, currency: 'ARS', date: '2026-11-03', tags: [], ...p };
}

const cash = acc('cash', 'cash', 10000);
const card = acc('card', 'credit');
const usd = acc('usd', 'bank', 500, 'USD');
const accounts = [cash, card, usd];

describe('balances', () => {
  it('applies income, expense and transfers', () => {
    const b = accountBalances(accounts, [
      tx({ type: 'income', amountCents: 5000, accountId: 'cash' }),
      tx({ type: 'expense', amountCents: 2000, accountId: 'cash' }),
      tx({ type: 'expense', amountCents: 3000, accountId: 'card' }),
      tx({ type: 'transfer', amountCents: 1000, accountId: 'cash', toAccountId: 'card' }),
      tx({ type: 'expense', amountCents: 999, accountId: 'cash', deleted: 1 }),
    ]);
    expect(b.get('cash')).toBe(12000);
    expect(b.get('card')).toBe(-2000);
  });

  it('subtracts card debt from the total and reports it apart, ignoring USD for now', () => {
    const b = new Map([
      ['cash', 12000],
      ['card', -2000],
      ['usd', 500],
    ]);
    expect(totals(accounts, b)).toEqual({ balanceCents: 10000, creditDebtCents: 2000 });
  });

  it('a card with positive balance is not debt', () => {
    expect(totals([card], new Map([['card', 300]]))).toEqual({
      balanceCents: 300,
      creditDebtCents: 0,
    });
  });
});

describe('month and series', () => {
  const txs = [
    tx({
      type: 'expense',
      amountCents: 100,
      accountId: 'cash',
      categoryId: 'a',
      date: '2026-11-01',
    }),
    tx({
      type: 'expense',
      amountCents: 300,
      accountId: 'cash',
      categoryId: 'b',
      date: '2026-11-03',
    }),
    tx({
      type: 'expense',
      amountCents: 50,
      accountId: 'cash',
      categoryId: 'a',
      date: '2026-11-03',
    }),
    tx({
      type: 'expense',
      amountCents: 70,
      accountId: 'cash',
      categoryId: 'c',
      date: '2026-10-31',
    }),
    tx({ type: 'income', amountCents: 1000, accountId: 'cash', date: '2026-11-02' }),
  ];

  it('totals a month', () => {
    expect(monthTotals(txs, '2026-11')).toEqual({ expenseCents: 450, incomeCents: 1000 });
  });

  it('builds a daily spending series ending today', () => {
    const s = dailySpending(txs, '2026-11-03', 5);
    expect(s).toEqual([0, 70, 100, 0, 350]); // 30 Oct … 3 Nov
  });

  it('ranks top categories of the month', () => {
    expect(topCategories(txs, '2026-11')).toEqual([
      { categoryId: 'b', cents: 300 },
      { categoryId: 'a', cents: 150 },
    ]);
  });
});
