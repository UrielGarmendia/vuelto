/**
 * Amounts the way people in Argentina write and say them: "23 lucas", "1 palo y medio",
 * "12k", "100 verdes", "1.500.000,50" or "1,500,000.50". Deterministic, no network.
 */

export interface FoundAmount {
  /** In units of the currency (pesos or dollars), may have decimals. */
  value: number;
  /** Only when the text says so ("verdes", "usd", "mangos", "$"). */
  currency?: 'ARS' | 'USD';
  /** Where it was found in the text given to `findAmounts`. */
  start: number;
  end: number;
}

const WORD_NUMBERS: Record<string, number> = {
  un: 1,
  una: 1,
  uno: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  quince: 15,
  veinte: 20,
  treinta: 30,
  cuarenta: 40,
  cincuenta: 50,
  cien: 100,
  ciento: 100,
  doscientos: 200,
  trescientos: 300,
  quinientos: 500,
  medio: 0.5,
  media: 0.5,
};

const MULTIPLIERS: Record<string, number> = {
  k: 1_000,
  luca: 1_000,
  lucas: 1_000,
  mil: 1_000,
  palo: 1_000_000,
  palos: 1_000_000,
  m: 1_000_000,
  millon: 1_000_000,
  millones: 1_000_000,
  mill: 1_000_000,
  gamba: 100,
  gambas: 100,
};

const USD_WORDS = new Set([
  'verde',
  'verdes',
  'dolar',
  'dolares',
  'usd',
  'dol',
  'u$s',
  'us$',
  'dls',
]);
const ARS_WORDS = new Set(['mango', 'mangos', 'peso', 'pesos', 'ars']);

/**
 * A written number with Argentine or English separators, read without ambiguity:
 * - two kinds of separator: the last one is the decimal (1.500.000,50 or 1,500,000.50);
 * - one kind used more than once: thousands (1.500.000);
 * - one separator followed by exactly three digits: thousands (1.500 or 1,500);
 * - otherwise it is the decimal (1,5 or 12.50).
 */
export function parseNumber(raw: string): number | undefined {
  const s = raw.replace(/[.,]+$/, '');
  if (!/^\d[\d.,]*$/.test(s)) return undefined;
  const seps = s.match(/[.,]/g) ?? [];
  let normal: string;
  if (seps.length === 0) normal = s;
  else if (new Set(seps).size === 2) {
    const last = s.search(/[.,](?=\d*$)/);
    normal = s.slice(0, last).replace(/[.,]/g, '') + '.' + s.slice(last + 1);
  } else if (seps.length > 1) normal = s.replace(/[.,]/g, '');
  else {
    const [int, frac] = s.split(/[.,]/) as [string, string];
    normal = frac.length === 3 ? int + frac : `${int}.${frac}`;
  }
  const n = Number(normal);
  return Number.isFinite(n) ? n : undefined;
}

/** Lowercase without accents; keeps the length of the text so positions still line up. */
export const fold = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').normalize('NFC').toLowerCase();

interface Token {
  text: string;
  start: number;
  end: number;
}

function tokens(text: string): Token[] {
  const out: Token[] = [];
  // Numbers (with separators), words, and the currency signs on their own.
  for (const m of text.matchAll(/us\$|u\$s|\$|\d[\d.,]*[a-z]*|[a-zñ]+/g)) {
    out.push({ text: m[0], start: m.index, end: m.index + m[0].length });
  }
  return out;
}

/** Every amount in `text`, left to right. Numbers that are clearly not money are skipped. */
export function findAmounts(text: string): FoundAmount[] {
  const folded = fold(text);
  const toks = tokens(folded);
  const found: FoundAmount[] = [];

  for (let i = 0; i < toks.length; i++) {
    const t = toks[i]!;
    let value: number | undefined;
    let multiplier = 1;
    let end = t.end;
    let j = i + 1; // next token after what this amount used

    const glued = /^(\d[\d.,]*)([a-z]*)$/.exec(t.text);
    if (glued) {
      value = parseNumber(glued[1]!);
      const suffix = glued[2]!;
      if (suffix) {
        if (!(suffix in MULTIPLIERS)) continue; // "12hs", "3ra"
        multiplier = MULTIPLIERS[suffix]!;
      }
    } else if (t.text in WORD_NUMBERS) {
      // A word number only counts with a multiplier after it ("una luca", "medio palo").
      if (!(toks[j]?.text && toks[j]!.text in MULTIPLIERS)) continue;
      value = WORD_NUMBERS[t.text];
    } else if (t.text === 'mil') {
      value = 1; // "mil pesos"
      multiplier = 1_000;
    } else continue;
    if (value === undefined) continue;

    // "2 mil", "23 lucas", "una luca": the multiplier as the next word.
    if (multiplier === 1 && toks[j] && toks[j]!.text in MULTIPLIERS) {
      multiplier = MULTIPLIERS[toks[j]!.text]!;
      end = toks[j]!.end;
      j++;
    }
    let amount = value * multiplier;
    // "y medio", "y media": half a multiplier (or half a unit without one).
    if (toks[j]?.text === 'y' && (toks[j + 1]?.text === 'medio' || toks[j + 1]?.text === 'media')) {
      amount += 0.5 * multiplier;
      end = toks[j + 1]!.end;
      j += 2;
    }
    let start = t.start;

    // Currency words or signs right before or right after.
    let currency: FoundAmount['currency'];
    const before = toks[i - 1]?.text ?? '';
    if (before === '$') {
      currency = 'ARS';
      start = toks[i - 1]!.start;
    } else if (before === 'us$' || before === 'u$s' || before === 'usd') {
      currency = 'USD';
      start = toks[i - 1]!.start;
    }
    const after = toks[j]?.text ?? '';
    if (USD_WORDS.has(after)) {
      currency = 'USD';
      end = toks[j]!.end;
    } else if (ARS_WORDS.has(after)) {
      currency = currency ?? 'ARS';
      end = toks[j]!.end;
    }

    found.push({ value: Math.round(amount * 100) / 100, currency, start, end });
    // Skip what was consumed.
    while (i + 1 < toks.length && toks[i + 1]!.start < end) i++;
  }
  return found;
}
