import { describe, expect, it } from 'vitest';
import { arsCents } from '../../lib/money';
import { dayChange, parseRates, withDay } from './rates';

describe('parseRates', () => {
  it('keeps oficial, blue and MEP selling prices', () => {
    const body = [
      { casa: 'oficial', compra: 1000, venta: 1050 },
      { casa: 'blue', compra: 1200, venta: 1230.5 },
      { casa: 'bolsa', compra: 1190, venta: 1210 },
      { casa: 'cripto', venta: 1300 },
    ];
    expect(parseRates(body, 5)).toEqual({
      values: { oficial: 1050, blue: 1230.5, mep: 1210 },
      fetchedAt: 5,
    });
  });

  it('drops anything malformed', () => {
    expect(parseRates({ error: true })).toBeNull();
    expect(
      parseRates([{ casa: 'blue', venta: '1200' }, null, { casa: 'oficial', venta: -1 }]),
    ).toBeNull();
  });
});

describe('arsCents', () => {
  it('converts dollars at the saved rate', () => {
    expect(arsCents({ amountCents: 1000, currency: 'ARS' })).toBe(1000);
    expect(arsCents({ amountCents: 1050, currency: 'USD', rateAtDate: 1210.5 })).toBe(1_271_025);
    expect(arsCents({ amountCents: 1050, currency: 'USD' })).toBe(0);
  });
});

describe('daily change of the dollar', () => {
  it('keeps the last quote of each day, ten days back', () => {
    let h = {};
    for (let d = 1; d <= 12; d++)
      h = withDay(h, `2026-11-${String(d).padStart(2, '0')}`, { mep: d });
    expect(Object.keys(h)).toHaveLength(10);
    expect(Object.keys(h)[0]).toBe('2026-11-03');
    expect(withDay(h, '2026-11-12', { mep: 99 })['2026-11-12']).toEqual({ mep: 99 });
  });

  it('compares today against the closest earlier day on record', () => {
    const h = {
      '2026-11-14': { mep: 1200, blue: 1230 },
      '2026-11-17': { mep: 1230 },
      '2026-11-18': { mep: 1215 },
    };
    expect(dayChange(h, 'mep', '2026-11-18')).toEqual({
      value: 1215,
      prev: 1230,
      pct: (-15 / 1230) * 100,
    });
    // Blue only on the 14th: no earlier day to compare with.
    expect(dayChange(h, 'blue', '2026-11-18')).toEqual({
      value: 1230,
      prev: undefined,
      pct: undefined,
    });
    expect(dayChange({}, 'mep', '2026-11-18')).toEqual({
      value: undefined,
      prev: undefined,
      pct: undefined,
    });
  });
});
