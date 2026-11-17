import { fromISODate, toISODate } from '../../lib/dates';
import { fold, parseNumber } from '../copilot/amount';
import { parseMessage, type CopilotDraft, type Missing, type ParseContext } from '../copilot/parse';

/** Money as receipts print it: "12.345,67", "1,234.50", "$ 980". */
const MONEY = /\$?\s*(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|\d+[.,]\d{1,2}|\d+)(?!\d)/g;

const amountsIn = (line: string) =>
  [...line.matchAll(MONEY)]
    .map((m) => parseNumber(m[1]!))
    .filter((n): n is number => n !== undefined && n > 0);

/**
 * The total: the amount on a line that says TOTAL (not subtotal), or the biggest amount
 * with cents anywhere on the receipt.
 */
export function receiptTotal(text: string): number | undefined {
  const lines = text.split(/\r?\n/);
  for (const raw of [...lines].reverse()) {
    const line = fold(raw);
    if (/\b(sub ?total|subtot)/.test(line) || !/\b(total|tot\b|a pagar|importe)/.test(line))
      continue;
    const found = amountsIn(raw);
    if (found.length) return found[found.length - 1];
  }
  const withCents = lines.flatMap((l) =>
    [...l.matchAll(MONEY)]
      .filter((m) => /[.,]\d{2}$/.test(m[1]!))
      .map((m) => parseNumber(m[1]!))
      .filter((n): n is number => n !== undefined),
  );
  return withCents.length ? Math.max(...withCents) : undefined;
}

/** The first plausible date (dd/mm/yy or dd/mm/yyyy), not in the future nor over a year old. */
export function receiptDate(text: string, today: string): string | undefined {
  const t = fromISODate(today);
  for (const m of text.matchAll(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})\b/g)) {
    const year = m[3]!.length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    const d = new Date(year, Number(m[2]) - 1, Number(m[1]));
    if (d.getDate() !== Number(m[1]) || d > t) continue;
    if (t.getTime() - d.getTime() > 366 * 86_400_000) continue;
    return toISODate(d);
  }
  return undefined;
}

/** Header lines that are never the shop's name. */
const NOT_A_NAME =
  /\b(factura|ticket|tique|cuit|iva|fecha|hora|caja|cajero|consumidor|original|responsable|inscripto|ing\.? ?brutos|domicilio|tel|www|cod|nro|n°|pto)\b/;

/** The shop: the first line near the top with words that are not a fiscal header. */
export function receiptMerchant(text: string): string | undefined {
  for (const raw of text.split(/\r?\n/).slice(0, 8)) {
    const line = raw
      .replace(/[^\p{L}\d .&'-]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if ((line.match(/\p{L}/gu) ?? []).length < 3 || NOT_A_NAME.test(fold(line))) continue;
    return line
      .toLowerCase()
      .replace(/(^|\s)\p{L}/gu, (c) => c.toUpperCase())
      .slice(0, 40);
  }
  return undefined;
}

const PAYMENT_WORDS = [
  'visa',
  'mastercard',
  'master',
  'amex',
  'naranja',
  'debito',
  'credito',
  'efectivo',
  'mercado pago',
];

/**
 * A suggested expense from a receipt's text: total, date, shop and, if printed, how it was
 * paid. The category and account come from the rules and the dictionary, as in the copilot.
 */
export function draftFromReceipt(text: string, ctx: ParseContext): CopilotDraft {
  const merchant = receiptMerchant(text);
  const total = receiptTotal(text);
  const folded = fold(text);
  const paid = PAYMENT_WORDS.find((w) => folded.includes(w));
  const [base] = parseMessage(
    [
      merchant ?? 'compra',
      paid && `con ${paid}`,
      ...folded
        .split(/\W+/)
        .filter((w) => /^[a-z]{4,}$/.test(w))
        .slice(0, 40),
    ]
      .filter(Boolean)
      .join(' '),
    ctx,
  );
  const missing: Missing[] = base!.missing.filter((m) => m !== 'amount');
  if (!total) missing.push('amount');
  return {
    ...base!,
    type: 'expense',
    amountCents: total ? Math.round(total * 100) : 0,
    date: receiptDate(text, ctx.today) ?? ctx.today,
    note: merchant ?? '',
    missing,
    confidence: Math.max(0, 0.9 - missing.length * 0.35),
    source: merchant ? `Ticket de ${merchant}` : 'Ticket',
  };
}
