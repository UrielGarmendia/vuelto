import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { newMeta, VueltoDB } from '../../db/db';
import type { Account, NetWorthDay } from '../../db/types';
import type { Snapshot } from '../external/provider';
import { netWorthOf, netWorthSeries, periodChange, recordNetWorth } from './networth';

const account = (over: Partial<Account>): Account => ({
  ...newMeta(0),
  name: 'x',
  kind: 'cash',
  currency: 'ARS',
  initialBalanceCents: 0,
  color: '#000',
  order: 0,
  archived: 0,
  ...over,
});

const snapshot: Snapshot = {
  provider: 'iol',
  cash: { ARS: 50_000, USD: 100 },
  positions: [
    {
      symbol: 'GGAL',
      description: 'GGAL',
      type: 'Acciones',
      currency: 'ARS',
      quantity: 1,
      valueCents: 300_000,
    },
  ],
  fetchedAt: 0,
};

describe('netWorthOf', () => {
  it('splits like Inicio: IOL cash is available, only positions are invested', () => {
    const cash = account({ id: 'cash' });
    const usd = account({ id: 'usd', currency: 'USD' });
    const card = account({ id: 'card', kind: 'credit' });
    const iol = account({
      id: 'iol',
      kind: 'investment',
      external: { provider: 'iol', blob: 'b', connectedAt: 0 },
    });
    const balances = new Map([
      ['cash', 1_000_000],
      ['usd', 10_000],
      ['card', -200_000],
      ['iol', 999],
    ]);
    const row = netWorthOf({
      date: '2026-11-16',
      accounts: [cash, usd, card, iol],
      balances,
      snapshot,
      usdRate: 1000,
    });
    // 10.000 + 100 USD + IOL cash 500 + 1 USD
    expect(row.availableCents).toBe(1_000_000 + 10_000_000 + 50_000 + 100_000);
    expect(row.investedCents).toBe(300_000);
    expect(row.debtCents).toBe(200_000);
    expect(row.totalCents).toBe(row.availableCents + 300_000 - 200_000);
    expect(row.totalUsdCents).toBe(Math.round(row.totalCents / 1000));
    expect(row.accounts.map((a) => a.id)).toEqual(['cash', 'usd', 'card']);

    const noRate = netWorthOf({ date: 'd', accounts: [cash, usd], balances });
    expect(noRate.availableCents).toBe(1_000_000);
    expect(noRate.usdRate).toBeUndefined();
  });
});

describe('recordNetWorth', () => {
  let db: VueltoDB;
  beforeEach(async () => {
    db = new VueltoDB(`networth-${crypto.randomUUID()}`);
    await db.open();
  });
  afterEach(() => db.delete());

  it('keeps one row per day, updated only when something changed', async () => {
    await recordNetWorth('2026-11-16', db);
    const first = await db.netWorth.get('2026-11-16');
    expect(first?.date).toBe('2026-11-16');
    await recordNetWorth('2026-11-16', db);
    expect((await db.netWorth.get('2026-11-16'))?.updatedAt).toBe(first?.updatedAt);

    const acc = (await db.accounts.toArray())[0]!;
    await db.accounts.update(acc.id, { initialBalanceCents: 123_400 });
    await recordNetWorth('2026-11-16', db);
    const second = await db.netWorth.get('2026-11-16');
    expect(second?.totalCents).toBe((first?.totalCents ?? 0) + 123_400);
    expect(second?.createdAt).toBe(first?.createdAt);
    expect(second?.synced).toBe(0);
    expect(await db.netWorth.count()).toBe(1);
  });
});

const day = (date: string, total: number, rate?: number): NetWorthDay => ({
  ...newMeta(0),
  id: date,
  date,
  accounts: [],
  availableCents: total,
  investedCents: 0,
  debtCents: 0,
  totalCents: total,
  ...(rate ? { usdRate: rate, totalUsdCents: Math.round(total / rate) } : {}),
});

describe('netWorthSeries', () => {
  const days = [
    day('2026-10-01', 1_000_000, 1000),
    day('2026-11-16', 1_500_000),
    day('2026-11-10', 1_200_000, 1200),
  ];
  const history = {
    at: 0,
    partial: false,
    ARG: [
      { date: '2026-09-18', cents: 300_000, mepCents: 300 },
      { date: '2026-09-20', cents: 400_000, mepCents: 400 },
      { date: '2026-10-05', cents: 999 },
    ],
    USA: [{ date: '2026-09-20', cents: 100_000, mepCents: 100 }],
  };

  it('cuts the range and fills the days before Vuelto with IOL history', () => {
    const all = netWorthSeries({
      days,
      history,
      range: 'Todo',
      currency: 'ARS',
      today: '2026-11-16',
      rate: 1000,
    });
    expect(all.map((p) => [p.date, p.total, p.own])).toEqual([
      ['2026-09-18', 300_000, false],
      ['2026-09-20', 400_000 + 100_000, false],
      ['2026-10-01', 1_000_000, true],
      ['2026-11-10', 1_200_000, true],
      ['2026-11-16', 1_500_000, true],
    ]);
    const month = netWorthSeries({
      days,
      history,
      range: '1M',
      currency: 'ARS',
      today: '2026-11-16',
    });
    expect(month.map((p) => p.date)).toEqual(['2026-11-10', '2026-11-16']);
  });

  it('in dollars uses each day’s rate and skips days without one', () => {
    const usd = netWorthSeries({ days, range: 'Todo', currency: 'USD', today: '2026-11-16' });
    expect(usd.map((p) => [p.date, p.total])).toEqual([
      ['2026-10-01', 1_000],
      ['2026-11-10', 1_000],
    ]);
  });

  it('in dollars prefers the MEP of each day over the chosen rate', () => {
    const withMep = [{ ...day('2026-11-10', 1_200_000, 1000), mepRate: 1200 }];
    const usd = netWorthSeries({
      days: withMep,
      range: 'Todo',
      currency: 'USD',
      today: '2026-11-16',
    });
    expect(usd[0]!.total).toBe(1_000);
  });

  it('in dollars takes IOL’s own MEP valuation for its history', () => {
    const usd = netWorthSeries({
      days,
      history,
      range: 'Todo',
      currency: 'USD',
      today: '2026-11-16',
    });
    expect(usd.slice(0, 2).map((p) => [p.date, p.total])).toEqual([
      ['2026-09-18', 300],
      ['2026-09-20', 500],
    ]);
  });

  it('measures the change between the first and last full days', () => {
    const all = netWorthSeries({
      days,
      history,
      range: 'Todo',
      currency: 'ARS',
      today: '2026-11-16',
      rate: 1000,
    });
    expect(periodChange(all)).toEqual({ cents: 500_000, pct: 50, iolOnly: false });
    // Fewer than two own days: IOL's history alone, and it says so.
    const iol = periodChange(all.slice(0, 3))!;
    expect(iol).toMatchObject({ cents: 200_000, iolOnly: true });
    expect(iol.pct).toBeCloseTo(66.67, 1);
    expect(periodChange(all.slice(0, 1))).toBeUndefined();
  });
});
