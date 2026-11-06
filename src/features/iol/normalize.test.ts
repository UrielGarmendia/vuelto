import { describe, expect, it } from 'vitest';
import { dayChange, snapshotTotal } from '../external/provider';
import { normalizeBalance, normalizePortfolio } from './normalize';

const balance = {
  cuentas: [
    { tipo: 'inversion_Argentina_Pesos', moneda: 'peso_Argentino', disponible: 12500.5 },
    { tipo: 'inversion_Argentina_Dolares', moneda: 'dolar_Estadounidense', disponible: 300 },
    { moneda: 'yen' },
  ],
  totalEnPesos: 999,
};

const portfolio = {
  pais: 'argentina',
  activos: [
    {
      cantidad: 10,
      valorizado: 50000,
      variacionDiaria: 2,
      gananciaPorcentaje: 15.5,
      titulo: {
        simbolo: 'GGAL',
        descripcion: 'Grupo Galicia',
        tipo: 'ACCIONES',
        moneda: 'peso_Argentino',
      },
    },
    {
      cantidad: 100,
      valorizado: 70,
      variacionDiaria: -1,
      titulo: {
        simbolo: 'AL30D',
        descripcion: 'Bono AL30',
        tipo: 'TitulosPublicos',
        moneda: 'dolar_Estadounidense',
      },
    },
    { cantidad: 1, titulo: { simbolo: 'X' } },
  ],
};

describe('IOL normalization', () => {
  it('takes available cash per currency', () => {
    expect(normalizeBalance(balance)).toEqual({ ARS: 1_250_050, USD: 30_000 });
    expect(normalizeBalance(null)).toEqual({ ARS: 0, USD: 0 });
  });

  it('maps positions and skips malformed ones', () => {
    const p = normalizePortfolio(portfolio);
    expect(p).toHaveLength(2);
    expect(p[0]).toEqual({
      symbol: 'GGAL',
      description: 'Grupo Galicia',
      type: 'acciones',
      currency: 'ARS',
      quantity: 10,
      valueCents: 5_000_000,
      dayChangePct: 2,
      gainPct: 15.5,
    });
    expect(p[1]).toMatchObject({ currency: 'USD', valueCents: 7_000, type: 'titulospublicos' });
    expect(normalizePortfolio({ activos: 'nope' })).toEqual([]);
  });

  it('totals in pesos and weights the day change by value', () => {
    const s = {
      provider: 'iol',
      cash: normalizeBalance(balance),
      positions: normalizePortfolio(portfolio),
      fetchedAt: 0,
    };
    // 12.500,50 + 300 USD × 1.000 + 50.000 + 70 USD × 1.000
    expect(snapshotTotal(s, 1000)).toBe(1_250_050 + 30_000_000 + 5_000_000 + 7_000_000);
    expect(snapshotTotal(s)).toBe(1_250_050 + 5_000_000);
    expect(dayChange(s)).toBeCloseTo((2 * 5_000_000 - 1 * 7_000) / 5_007_000);
  });
});
