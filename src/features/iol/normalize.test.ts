import { describe, expect, it } from 'vitest';
import {
  cashTotal,
  dayChange,
  investedTotal,
  snapshotTotal,
  type Snapshot,
} from '../external/provider';
import { assetCategory, normalizeBalance, normalizePortfolio } from './normalize';

// Shaped like IOL's MCP answers; every amount is made up.
const terms = (t0: number, later = t0) => ({ t0, t1: later, t2: later, t3: later });

const balance = {
  arg_ars: {
    totals: terms(150_000, 160_000),
    available: terms(100_000, 110_000),
    committed: terms(50_000),
    available_for_withdrawal: 100_000,
  },
  arg_usd: {
    totals: terms(200),
    available: terms(200),
    committed: terms(0),
    available_for_withdrawal: 200,
  },
  eeuu_usd: {
    totals: terms(50.5),
    available: terms(50.5),
    committed: terms(0),
    available_for_withdrawal: 50.5,
  },
};

const asset = (over: Record<string, unknown>) => ({
  symbol: 'X',
  description: 'X',
  market: 'BCBA',
  type: 'Acciones',
  currency: 'ARS',
  units_per_lot: 1,
  country: 'ARG',
  term: 'T1',
  ...over,
});

const argentina = {
  country: 'ARG',
  positions: [
    {
      quantity: 10,
      unit_price: 5000,
      lot_price: 5000,
      committed: 0,
      daily_change_pct: 1.5,
      asset: asset({ symbol: 'GGAL', description: 'Grupo Galicia', type: 'Acciones' }),
    },
    {
      quantity: 4,
      unit_price: 25_000,
      lot_price: 25_000,
      committed: 0,
      daily_change_pct: -2,
      asset: asset({ symbol: 'SPY', type: 'CEDEARS' }),
    },
    // A bond quoted per 100 nominals: the lot price is the quote itself.
    {
      quantity: 1000,
      unit_price: 85_000,
      lot_price: 85_000,
      committed: 0,
      daily_change_pct: 0.5,
      asset: asset({ symbol: 'AL30', type: 'Títulos Públicos', units_per_lot: 100 }),
    },
    {
      quantity: 1000,
      unit_price: 1.25,
      lot_price: 1.25,
      committed: 0,
      daily_change_pct: 0.1,
      asset: asset({ symbol: 'FIMA', type: 'Fondo Común de Inversión', term: 'T0' }),
    },
    {
      quantity: 2,
      unit_price: 10,
      lot_price: 10,
      committed: 0,
      daily_change_pct: 0,
      asset: asset({ symbol: 'GGALC', type: 'Opciones' }),
    },
    { quantity: 1, asset: asset({ symbol: 'NOPRICE' }) },
    { quantity: 1, unit_price: 1, asset: asset({ symbol: 'EUR', currency: 'EUR' }) },
  ],
};

const unitedStates = {
  country: 'USA',
  positions: [
    {
      quantity: 2,
      unit_price: 200,
      lot_price: 200,
      committed: 0,
      daily_change_pct: 1,
      asset: asset({ symbol: 'AAPL', type: 'Acciones', currency: 'USD', market: 'NASDAQ' }),
    },
  ],
};

describe('IOL balance', () => {
  it('takes settled cash (t0) per account and sums it per currency', () => {
    expect(normalizeBalance(balance)).toEqual({
      cash: { ARS: 15_000_000, USD: 25_050 },
      accounts: [
        {
          id: 'arg_ars',
          label: 'Pesos',
          currency: 'ARS',
          totalCents: 15_000_000,
          availableCents: 10_000_000,
        },
        {
          id: 'arg_usd',
          label: 'Dólares (Argentina)',
          currency: 'USD',
          totalCents: 20_000,
          availableCents: 20_000,
        },
        {
          id: 'eeuu_usd',
          label: 'Dólares (EE.UU.)',
          currency: 'USD',
          totalCents: 5_050,
          availableCents: 5_050,
        },
      ],
    });
  });

  it('accepts the answer wrapped in data and survives junk', () => {
    expect(normalizeBalance({ data: balance }).cash).toEqual({ ARS: 15_000_000, USD: 25_050 });
    expect(normalizeBalance(null)).toEqual({ cash: { ARS: 0, USD: 0 }, accounts: [] });
    expect(normalizeBalance({ arg_ars: 'nope' }).cash).toEqual({ ARS: 0, USD: 0 });
  });
});

describe('IOL portfolio', () => {
  it('values each position as quantity × unit price, minding lots', () => {
    const p = normalizePortfolio(argentina);
    expect(p.map((x) => x.symbol)).toEqual(['GGAL', 'SPY', 'AL30', 'FIMA', 'GGALC']);
    expect(p[0]).toEqual({
      symbol: 'GGAL',
      description: 'Grupo Galicia',
      type: 'Acciones',
      currency: 'ARS',
      quantity: 10,
      valueCents: 5_000_000,
      dayChangePct: 1.5,
    });
    expect(p[1]!.valueCents).toBe(10_000_000);
    // 1000 nominals at 85.000 per 100 = 850.000
    expect(p[2]!.valueCents).toBe(85_000_000);
    expect(p[3]!.valueCents).toBe(125_000);
  });

  it('values a lot-sized instrument quoted per unit the same way', () => {
    const perUnit = {
      positions: [
        {
          quantity: 1000,
          unit_price: 850,
          lot_price: 85_000,
          daily_change_pct: 0,
          asset: asset({ type: 'Títulos Públicos', units_per_lot: 100 }),
        },
      ],
    };
    expect(normalizePortfolio(perUnit)[0]!.valueCents).toBe(85_000_000);
  });

  it('reads the US portfolio and the data wrapper', () => {
    expect(normalizePortfolio({ data: unitedStates })).toEqual([
      expect.objectContaining({ symbol: 'AAPL', currency: 'USD', valueCents: 40_000 }),
    ]);
    expect(normalizePortfolio({ positions: 'nope' })).toEqual([]);
  });
});

describe('asset categories', () => {
  it('maps IOL types to readable classes and the rest to Otros', () => {
    const cases: [string, string][] = [
      ['Acciones', 'Acciones'],
      ['CEDEARS', 'CEDEARs'],
      ['Títulos Públicos', 'Bonos'],
      ['TitulosPublicos', 'Bonos'],
      ['Letras', 'Bonos'],
      ['Obligaciones Negociables', 'ONs'],
      ['Fondo Común de Inversión', 'FCI'],
      ['Cauciones', 'Cauciones'],
      ['Opciones', 'Otros'],
      ['', 'Otros'],
    ];
    for (const [type, category] of cases) expect(assetCategory(type)).toBe(category);
    // Already readable classes stay as they are.
    for (const c of ['Acciones', 'CEDEARs', 'Bonos', 'ONs', 'FCI', 'Cauciones', 'Otros'])
      expect(assetCategory(c)).toBe(c);
  });
});

describe('IOL snapshot', () => {
  const s: Snapshot = {
    provider: 'iol',
    ...normalizeBalance(balance),
    positions: [...normalizePortfolio(argentina), ...normalizePortfolio(unitedStates)],
    fetchedAt: 0,
  };
  const pesos = 5_000_000 + 10_000_000 + 85_000_000 + 125_000 + 2_000;

  it('adds cash and positions in pesos', () => {
    expect(investedTotal(s, 1000)).toBe(pesos + 40_000 * 1000);
    expect(snapshotTotal(s, 1000)).toBe(15_000_000 + 25_050 * 1000 + pesos + 40_000 * 1000);
    // Without a rate the dollars are left out instead of guessed.
    expect(snapshotTotal(s)).toBe(15_000_000 + pesos);
    // Inicio and the IOL card split it the same way: cash apart from positions.
    expect(cashTotal(s, 1000)).toBe(15_000_000 + 25_050 * 1000);
    expect(cashTotal(s, 1000) + investedTotal(s, 1000)).toBe(snapshotTotal(s, 1000));
  });

  it('weights the day change by each position’s value in pesos', () => {
    const weighted =
      1.5 * 5_000_000 +
      -2 * 10_000_000 +
      0.5 * 85_000_000 +
      0.1 * 125_000 +
      0 * 2_000 +
      1 * 40_000_000;
    expect(dayChange(s, 1000)).toBeCloseTo(weighted / (pesos + 40_000_000));
    expect(dayChange(s)).toBeCloseTo((weighted - 40_000_000) / pesos);
  });
});
