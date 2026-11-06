import { describe, expect, it } from 'vitest';
import type { Account, Transaction } from '../../db/types';
import {
  accountBalances,
  addMonths,
  dailySpending,
  daysInMonth,
  monthDaily,
  monthTotals,
  pastMonths,
  pastPace,
  topCategories,
  totals,
} from './summary';

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

describe('month helpers', () => {
  it('knows month lengths and crosses years', () => {
    expect(daysInMonth('2026-02')).toBe(28);
    expect(daysInMonth('2028-02')).toBe(29);
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(addMonths('2026-11', 2)).toBe('2027-01');
  });

  it('spreads spending over the days of the month', () => {
    const daily = monthDaily(
      [
        tx({ type: 'expense', amountCents: 500, accountId: 'a', date: '2026-11-01' }),
        tx({ type: 'expense', amountCents: 300, accountId: 'a', date: '2026-11-30' }),
        tx({ type: 'income', amountCents: 999, accountId: 'a', date: '2026-11-30' }),
        tx({ type: 'expense', amountCents: 999, accountId: 'a', date: '2026-10-31' }),
      ],
      '2026-11',
    );
    expect(daily).toHaveLength(30);
    expect(daily[0]).toBe(500);
    expect(daily[29]).toBe(300);
  });

  it('totals the previous months, most recent first', () => {
    const months = pastMonths(
      [
        tx({ type: 'expense', amountCents: 100, accountId: 'a', date: '2026-10-05' }),
        tx({ type: 'expense', amountCents: 200, accountId: 'a', date: '2026-09-05' }),
        tx({ type: 'expense', amountCents: 400, accountId: 'a', date: '2026-11-05', deleted: 1 }),
      ],
      '2026-11',
      3,
    );
    expect(months.map((m) => [m.month, m.spentCents])).toEqual([
      ['2026-10', 100],
      ['2026-09', 200],
      ['2026-08', 0],
    ]);
  });
});

describe('pastPace', () => {
  it('averages what earlier months had spent by the same day', () => {
    const pace = pastPace(
      [
        tx({ type: 'expense', amountCents: 1000, accountId: 'a', date: '2026-10-01' }),
        tx({ type: 'expense', amountCents: 500, accountId: 'a', date: '2026-10-20' }),
        tx({ type: 'expense', amountCents: 3000, accountId: 'a', date: '2026-09-02' }),
      ],
      '2026-11',
      5,
    );
    expect(pace).toEqual({ upToDay: 2000, total: 2250 });
    expect(pastPace([], '2026-11', 5)).toBeNull();
  });
});
