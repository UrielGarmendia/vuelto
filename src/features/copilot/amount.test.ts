import { describe, expect, it } from 'vitest';
import { findAmounts, parseNumber } from './amount';

/** [text, expected amounts as value or value + currency] */
const CASES: [string, (number | [number, 'ARS' | 'USD'])[]][] = [
  // The examples the copilot has to understand.
  ['gasté 800 en el bondi', [800]],
  ['vendí un escape por 350000', [350_000]],
  ['super 23 lucas con mp', [23_000]],
  ['ayer birra con los pibes 12k en efectivo', [12_000]],
  ['heladera en 12 cuotas, 1 palo y medio con la visa', [12, 1_500_000]],
  ['cobré el sueldo, 2,3 palos', [2_300_000]],
  ['pasé 50 lucas de mp al banco', [50_000]],
  ['nafta 35 lucas y sube 2 lucas', [35_000, 2_000]],
  ['100 verdes que me debía juan', [[100, 'USD']]],
  // luca / k / mil
  ['una luca', [1_000]],
  ['una luca y media', [1_500]],
  ['2 lucas y media', [2_500]],
  ['1 luca', [1_000]],
  ['15k', [15_000]],
  ['1,5k', [1_500]],
  ['1.5k', [1_500]],
  ['2 mil', [2_000]],
  ['mil pesos', [[1_000, 'ARS']]],
  ['20 mil mangos', [[20_000, 'ARS']]],
  // palo / M / millón
  ['un palo', [1_000_000]],
  ['medio palo', [500_000]],
  ['2 palos', [2_000_000]],
  ['3M', [3_000_000]],
  ['1,2 millones', [1_200_000]],
  ['dos palos y medio', [2_500_000]],
  // gamba
  ['una gamba', [100]],
  ['5 gambas', [500]],
  // currencies
  ['50 dólares', [[50, 'USD']]],
  ['usd 200', [[200, 'USD']]],
  ['US$ 1.500', [[1_500, 'USD']]],
  ['u$s 30', [[30, 'USD']]],
  ['300 dol', [[300, 'USD']]],
  ['$ 4500', [[4_500, 'ARS']]],
  ['10 mangos', [[10, 'ARS']]],
  // Argentine and English separators
  ['1.500.000,50', [1_500_000.5]],
  ['1,500,000.50', [1_500_000.5]],
  ['1.500.000', [1_500_000]],
  ['1,500,000', [1_500_000]],
  ['1.500', [1_500]],
  ['1,500', [1_500]],
  ['1,5', [1.5]],
  ['12.50', [12.5]],
  ['$ 23.456,78', [[23_456.78, 'ARS']]],
  // what is not money
  ['3 cuotas de nada', [3]],
  ['a las 12hs', []],
  ['sin números', []],
  ['una birra', []],
  ['la 3ra vez', []],
];

describe('findAmounts', () => {
  it.each(CASES)('%s', (text, expected) => {
    const got = findAmounts(text).map((a) => (a.currency ? [a.value, a.currency] : a.value));
    const want = expected;
    // A plain number in the table means "no currency said" or any currency; check value only.
    expect(got.length).toBe(want.length);
    want.forEach((w, i) => {
      if (Array.isArray(w)) expect(got[i]).toEqual(w);
      else expect(Array.isArray(got[i]) ? (got[i] as [number])[0] : got[i]).toBeCloseTo(w, 2);
    });
  });

  it('has at least forty cases', () => {
    expect(CASES.length).toBeGreaterThanOrEqual(40);
  });

  it('reports where each amount is, to cut it out of the note', () => {
    const text = 'nafta 35 lucas y sube 2 lucas';
    const [a, b] = findAmounts(text);
    expect(text.slice(a!.start, a!.end)).toBe('35 lucas');
    expect(text.slice(b!.start, b!.end)).toBe('2 lucas');
    const usd = 'le debo 100 verdes';
    const [c] = findAmounts(usd);
    expect(usd.slice(c!.start, c!.end)).toBe('100 verdes');
  });
});

describe('parseNumber', () => {
  it('reads separators without ambiguity and rejects junk', () => {
    expect(parseNumber('1.234.567,8')).toBe(1_234_567.8);
    expect(parseNumber('1,234,567.8')).toBe(1_234_567.8);
    expect(parseNumber('10.')).toBe(10);
    expect(parseNumber('abc')).toBeUndefined();
  });
});
