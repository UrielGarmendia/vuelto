import { parseCents } from './money';

export type AmountKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | ',' | 'back';

const MAX_INT_DIGITS = 10;

/** Applies a keypad press to the raw typed amount ("1234,5"). Invalid presses are no-ops. */
export function applyAmountKey(input: string, key: AmountKey): string {
  if (key === 'back') return input.slice(0, -1);
  const [int = '', dec] = input.split(',');
  if (key === ',') {
    if (dec !== undefined) return input;
    return (int || '0') + ',';
  }
  if (dec !== undefined) return dec.length >= 2 ? input : input + key;
  if (int === '0') return key; // no leading zeros
  if (int.length >= MAX_INT_DIGITS) return input;
  return input + key;
}

export function amountInputToCents(input: string): number {
  if (!input) return 0;
  return parseCents(input.replace(/,$/, '')) ?? 0;
}

export function centsToAmountInput(cents: number): string {
  const int = Math.trunc(cents / 100);
  const dec = cents % 100;
  return dec === 0 ? String(int) : `${int},${String(dec).padStart(2, '0').replace(/0$/, '')}`;
}

const intFormat = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });

/** Display form while typing: keeps a trailing comma and partial decimals ("1.234,5"). */
export function formatAmountInput(input: string): string {
  const [int = '', dec] = input.split(',');
  const grouped = intFormat.format(Number(int || '0'));
  return dec === undefined ? grouped : `${grouped},${dec}`;
}
