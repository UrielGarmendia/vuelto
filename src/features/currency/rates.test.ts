import { describe, expect, it } from 'vitest';
import { arsCents } from '../../lib/money';
import { parseRates } from './rates';

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
