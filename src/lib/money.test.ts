import { describe, expect, it } from 'vitest';
import { formatMoney, parseCents, splitInstallments, sumCents } from './money';

const nbsp = (s: string) => s.replace(/\u00a0/g, ' ');

describe('formatMoney', () => {
  it('formats ARS with es-AR separators', () => {
    expect(nbsp(formatMoney(123456))).toBe('$ 1.234,56');
  });
  it('hides decimals on whole amounts in auto mode', () => {
    expect(nbsp(formatMoney(150000))).toBe('$ 1.500');
  });
  it('forces decimals when asked', () => {
    expect(nbsp(formatMoney(150000, 'ARS', { decimals: true }))).toBe('$ 1.500,00');
  });
  it('formats negatives and zero', () => {
    expect(nbsp(formatMoney(-5))).toBe('-$ 0,05');
    expect(nbsp(formatMoney(0))).toBe('$ 0');
  });
  it('formats USD', () => {
    expect(nbsp(formatMoney(1999, 'USD'))).toBe('US$ 19,99');
  });
  it('rejects non-integer cents', () => {
    expect(() => formatMoney(1.5)).toThrow(RangeError);
    expect(() => formatMoney(Number.NaN)).toThrow(RangeError);
  });
});

describe('parseCents', () => {
  it.each([
    ['1.234,56', 123456],
    ['1234,5', 123450],
    ['1234.56', 123456],
    ['1.234', 123400],
    ['1.234.567', 123456700],
    ['0,1', 10],
    ['$ 2.500', 250000],
    ['US$ 19,99', 1999],
    ['-12,34', -1234],
    ['-0', 0],
    ['0.29', 29], // 0.29 * 100 would be 28.999… in float math
    ['1.005', 100500], // read as thousands
  ])('parses %s', (input, expected) => {
    expect(parseCents(input)).toBe(expected);
  });

  it.each(['', 'abc', '1,234,5', '1.2.3', '12,345', '1e3', '--1'])('rejects %s', (input) => {
    expect(parseCents(input)).toBeNull();
  });

  it('round-trips with formatMoney', () => {
    for (const c of [0, 1, 99, 100, 123456, -98765, 1000000000]) {
      expect(parseCents(formatMoney(c, 'ARS', { decimals: true }))).toBe(c);
    }
  });
});

describe('sumCents', () => {
  it('sums integers exactly', () => {
    expect(sumCents([10, 20, -5])).toBe(25);
    expect(sumCents([])).toBe(0);
  });
  it('rejects floats and overflow', () => {
    expect(() => sumCents([0.1, 0.2])).toThrow(RangeError);
    expect(() => sumCents([Number.MAX_SAFE_INTEGER, 1])).toThrow(RangeError);
  });
});

describe('splitInstallments', () => {
  it('splits evenly', () => {
    expect(splitInstallments(30000, 3)).toEqual([10000, 10000, 10000]);
  });
  it('puts the remainder on the last installment', () => {
    expect(splitInstallments(10000, 3)).toEqual([3333, 3333, 3334]);
    expect(splitInstallments(100, 6)).toEqual([16, 16, 16, 16, 16, 20]);
  });
  it('always preserves the total', () => {
    for (const total of [1, 7, 99999, 123457, -1001]) {
      for (const n of [1, 2, 3, 6, 12, 18]) {
        expect(sumCents(splitInstallments(total, n))).toBe(total);
      }
    }
  });
  it('handles fewer cents than installments', () => {
    expect(splitInstallments(2, 3)).toEqual([0, 0, 2]);
  });
  it('rejects invalid counts', () => {
    expect(() => splitInstallments(100, 0)).toThrow(RangeError);
    expect(() => splitInstallments(100, 1.5)).toThrow(RangeError);
  });
});
