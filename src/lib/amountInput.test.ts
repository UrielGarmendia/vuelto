import { describe, expect, it } from 'vitest';
import {
  amountInputToCents,
  applyAmountKey,
  centsToAmountInput,
  formatAmountInput,
  type AmountKey,
} from './amountInput';

const type = (keys: AmountKey[], start = '') => keys.reduce(applyAmountKey, start);

describe('applyAmountKey', () => {
  it('builds integers and decimals', () => {
    expect(type(['1', '2', '5', '0'])).toBe('1250');
    expect(type(['1', ',', '5'])).toBe('1,5');
  });
  it('limits decimals to two and allows a single comma', () => {
    expect(type(['1', ',', '5', '0', '9'])).toBe('1,50');
    expect(type(['1', ',', ','])).toBe('1,');
  });
  it('prefixes a zero when starting with a comma', () => {
    expect(type([',', '5'])).toBe('0,5');
  });
  it('avoids leading zeros', () => {
    expect(type(['0', '0', '7'])).toBe('7');
  });
  it('caps the integer part', () => {
    expect(type(Array<AmountKey>(12).fill('9'))).toBe('9999999999');
  });
  it('deletes the last character', () => {
    expect(type(['back'], '12,5')).toBe('12,');
    expect(type(['back'], '')).toBe('');
  });
});

describe('conversions', () => {
  it('converts to cents, tolerating a trailing comma', () => {
    expect(amountInputToCents('1250')).toBe(125000);
    expect(amountInputToCents('1,5')).toBe(150);
    expect(amountInputToCents('12,')).toBe(1200);
    expect(amountInputToCents('')).toBe(0);
  });
  it('round-trips cents to input', () => {
    for (const c of [0, 5, 50, 150, 125000, 123456]) {
      expect(amountInputToCents(centsToAmountInput(c))).toBe(c);
    }
    expect(centsToAmountInput(150)).toBe('1,5');
    expect(centsToAmountInput(105)).toBe('1,05');
  });
  it('formats while typing', () => {
    expect(formatAmountInput('')).toBe('0');
    expect(formatAmountInput('1234567')).toBe('1.234.567');
    expect(formatAmountInput('1234,')).toBe('1.234,');
    expect(formatAmountInput('1234,5')).toBe('1.234,5');
  });
});
