export type Currency = 'ARS' | 'USD';

const formatters = new Map<string, Intl.NumberFormat>();

function formatter(currency: Currency, decimals: boolean): Intl.NumberFormat {
  const key = `${currency}-${decimals}`;
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency,
      minimumFractionDigits: decimals ? 2 : 0,
      maximumFractionDigits: decimals ? 2 : 0,
    });
    formatters.set(key, f);
  }
  return f;
}

function assertCents(cents: number): void {
  if (!Number.isSafeInteger(cents)) throw new RangeError(`Invalid cents value: ${cents}`);
}

/** Formats integer cents. `decimals: 'auto'` hides ",00" on whole amounts. */
export function formatMoney(
  cents: number,
  currency: Currency = 'ARS',
  { decimals = 'auto' }: { decimals?: boolean | 'auto' } = {},
): string {
  assertCents(cents);
  const show = decimals === 'auto' ? cents % 100 !== 0 : decimals;
  // Divide only for display; the value never goes back into arithmetic.
  return formatter(currency, show).format(cents / 100);
}

/**
 * Parses user/CSV input into cents without float math.
 * Accepts es-AR ("1.234,56") and plain ("1234.56") notation. Returns null if invalid.
 */
export function parseCents(input: string): number | null {
  let s = input.replace(/[\s$]|US/g, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const m = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(s);
  if (!m) return null;
  const [, sign, whole, frac = ''] = m;
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents)) return null;
  return sign && cents !== 0 ? -cents : cents;
}

export function sumCents(values: readonly number[]): number {
  let total = 0;
  for (const v of values) {
    assertCents(v);
    total += v;
  }
  assertCents(total);
  return total;
}

/** Splits a total into n installments; the remainder goes to the last one. */
export function splitInstallments(totalCents: number, n: number): number[] {
  assertCents(totalCents);
  if (!Number.isInteger(n) || n < 1) throw new RangeError(`Invalid installment count: ${n}`);
  const base = Math.trunc(totalCents / n);
  const parts = Array<number>(n).fill(base);
  parts[n - 1] = totalCents - base * (n - 1);
  return parts;
}

/** A movement's amount in pesos: USD converts at the rate it was saved with. */
export function arsCents(tx: { amountCents: number; currency: Currency; rateAtDate?: number }) {
  if (tx.currency === 'ARS') return tx.amountCents;
  return tx.rateAtDate ? Math.round(tx.amountCents * tx.rateAtDate) : 0;
}
