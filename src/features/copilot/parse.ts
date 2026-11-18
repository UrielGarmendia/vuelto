import type { Account, Category, Rule, TxType } from '../../db/types';
import { fromISODate, toISODate } from '../../lib/dates';
import { matchRule } from '../rules/rules';
import { findAmounts, fold } from './amount';
import {
  ACCOUNT_WORDS,
  CATEGORY_WORDS,
  EXPENSE_WORDS,
  INCOME_WORDS,
  TRANSFER_WORDS,
} from './dictionary';

export interface ParseContext {
  categories: readonly Category[];
  accounts: readonly Account[];
  rules: readonly Rule[];
  /** YYYY-MM-DD */
  today: string;
  /** Used when the message names no account (the last one used). */
  defaultAccountId?: string;
}

export type Missing = 'amount' | 'category' | 'account' | 'destination';

/** One movement read from the message, ready to show as an editable card. */
export interface CopilotDraft {
  type: TxType;
  /** Zero when no amount was found. */
  amountCents: number;
  currency: 'ARS' | 'USD';
  categoryId?: string;
  accountId?: string;
  toAccountId?: string;
  date: string;
  installments?: number;
  note: string;
  tag?: string;
  /** 0–1: how sure the local reading is. Under 0,7 the card asks to be checked. */
  confidence: number;
  /** What could not be settled, so the card (or the AI) can fill it in. */
  missing: Missing[];
  /** The piece of the message this card came from. */
  source: string;
}

const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
const STOP = new Set([
  'con',
  'de',
  'del',
  'el',
  'la',
  'los',
  'las',
  'en',
  'y',
  'a',
  'al',
  'para',
  'por',
  'un',
  'una',
  'que',
  'me',
  'mi',
  'lo',
  'le',
  'se',
  'hoy',
  'ayer',
  'anteayer',
]);

/** The text padded with spaces and every symbol as a space: positions stay those of `s` + 1. */
const words = (s: string) => ` ${s.replace(/[^a-z0-9ñ$]/g, ' ')} `;
const hasPhrase = (text: string, phrase: string) =>
  words(text).replace(/ +/g, ' ').includes(` ${phrase} `);
const addDays = (iso: string, n: number) =>
  toISODate(new Date(fromISODate(iso).getTime() + n * 86_400_000));

interface Span {
  start: number;
  end: number;
}

/** Relative dates in Spanish: "ayer", "anteayer", "el viernes", "el 3". */
function readDate(text: string, today: string): { date: string; span?: Span } {
  const anteayer = /\b(anteayer|antes de ayer)\b/.exec(text);
  if (anteayer) return { date: addDays(today, -2), span: spanOf(anteayer) };
  const ayer = /\bayer\b/.exec(text);
  if (ayer) return { date: addDays(today, -1), span: spanOf(ayer) };
  const weekday = new RegExp(`\\b(?:el )?(${WEEKDAYS.join('|')})\\b`).exec(text);
  if (weekday) {
    // The most recent one, today included.
    const back = (fromISODate(today).getDay() - WEEKDAYS.indexOf(weekday[1]!) + 7) % 7;
    return { date: addDays(today, -back), span: spanOf(weekday) };
  }
  const day = /\bel (\d{1,2})\b(?! ?(?:cuota|luca|palo|k\b|mil|verde|dolar|peso|mango|%))/.exec(
    text,
  );
  if (day) {
    const n = Number(day[1]);
    const t = fromISODate(today);
    if (n >= 1 && n <= 31) {
      // A day after today means last month's.
      const d = new Date(t.getFullYear(), t.getMonth() - (n > t.getDate() ? 1 : 0), n);
      if (d.getDate() === n) return { date: toISODate(d), span: spanOf(day) };
    }
  }
  return { date: today };
}

const spanOf = (m: RegExpExecArray): Span => ({ start: m.index, end: m.index + m[0].length });

function readInstallments(text: string): { n?: number; span?: Span } {
  const m = /\b(?:en )?(\d{1,2}) cuotas?\b/.exec(text);
  if (!m) return {};
  const n = Number(m[1]);
  return n >= 2 && n <= 48 ? { n, span: spanOf(m) } : {};
}

/** Blanks out spans (same length), so later searches skip them but positions still match. */
const blank = (text: string, spans: (Span | undefined)[]) =>
  spans.reduce(
    (t, s) => (s ? t.slice(0, s.start) + ' '.repeat(s.end - s.start) + t.slice(s.end) : t),
    text,
  );

/**
 * Accounts named in the text, in order of appearance, and where every account word was said
 * (also "visa" without a card), so the note leaves them out.
 */
function mentionedAccounts(text: string, accounts: readonly Account[]) {
  const usable = accounts.filter((a) => !a.deleted && !a.archived && !a.external);
  const hits: { account: Account; at: number; span: Span }[] = [];
  const said: Span[] = [];
  const seen = new Set<string>();
  // Index in the padded text = position of the phrase in `text`.
  const spanOfPhrase = (phrase: string) => {
    const at = words(text).indexOf(` ${phrase} `);
    return at < 0 ? undefined : { start: at, end: at + phrase.length };
  };
  const add = (account: Account, phrase: string) => {
    const span = spanOfPhrase(phrase);
    if (!span || seen.has(account.id)) return;
    seen.add(account.id);
    hits.push({ account, at: span.start, span });
  };
  // A name said as such ("Naranja X", "Banco Galicia") first.
  for (const a of usable) {
    const name = fold(a.name);
    if (name.length >= 3 && hasPhrase(text, name)) add(a, name);
  }
  for (const { words: list, pick } of ACCOUNT_WORDS) {
    const phrase = list.find((w) => hasPhrase(text, w));
    if (!phrase) continue;
    const span = spanOfPhrase(phrase);
    if (span) said.push(span);
    const named = usable.find((a) => fold(a.name).includes(phrase));
    const account = named ?? usable.find((a) => pick(a, fold(a.name)));
    if (account) add(account, phrase);
  }
  return { hits: hits.sort((a, b) => a.at - b.at), said: [...said, ...hits.map((h) => h.span)] };
}

/** Income categories that fit "anything else", for an income nothing else explains. */
const CATCH_ALL_INCOME = ['otros', 'otros ingresos', 'varios', 'otro'];

function readType(text: string, accountsNamed: number): TxType {
  if (INCOME_WORDS.some((w) => hasPhrase(text, w))) return 'income';
  if (accountsNamed >= 2 && TRANSFER_WORDS.some((w) => hasPhrase(text, w))) return 'transfer';
  return 'expense';
}

/** The category for a piece of text: a rule first, then the dictionary, by the user's names. */
function readCategory(
  original: string,
  text: string,
  type: TxType,
  ctx: ParseContext,
): { categoryId?: string; rule?: Rule } {
  const rule = matchRule(original, ctx.rules);
  const ruled = rule && ctx.categories.find((c) => c.id === rule.categoryId && !c.deleted);
  if (rule && ruled) return { categoryId: ruled.id, rule };
  const usable = ctx.categories.filter((c) => !c.deleted && !c.archived && c.type === type);
  // The word said first wins ("super y nafta" is a supermarket).
  let best: { at: number; id: string } | undefined;
  for (const entry of CATEGORY_WORDS) {
    if (entry.type !== type) continue;
    for (const w of entry.words) {
      const at = words(text).indexOf(` ${w} `);
      if (at < 0 || (best && best.at <= at)) continue;
      const found = entry.names
        .map((n) => usable.find((c) => fold(c.name) === fold(n)))
        .find(Boolean);
      // A word whose category the user doesn't have still counts as found: it stays empty.
      best = { at, id: found?.id ?? '' };
    }
  }
  return { categoryId: best?.id || undefined };
}

function noteOf(original: string, spans: Span[]): string {
  const kept = blank(original, spans)
    .split(/\s+/)
    .filter((w) => /[\p{L}\d]/u.test(w))
    .filter((w) => ![...INCOME_WORDS, ...TRANSFER_WORDS, ...EXPENSE_WORDS].includes(fold(w)));
  while (kept.length && STOP.has(fold(kept[0]!))) kept.shift();
  while (kept.length && STOP.has(fold(kept[kept.length - 1]!))) kept.pop();
  const note = kept.join(' ').replace(/[,.;]+$/, '');
  return note ? note[0]!.toUpperCase() + note.slice(1) : '';
}

/** Splits a message into pieces that each hold one movement. */
export function splitMessage(message: string): string[] {
  const out: string[] = [];
  for (const line of message.split(/[\n;]+/)) {
    // Commas followed by a space and " y " (not "y medio") may separate movements…
    const pieces = line.split(/,\s+|\s+y\s+(?!medi[oa]\b)/i).filter((p) => p.trim());
    const merged: string[] = [];
    for (const piece of pieces) {
      const sep = line.slice(0, line.indexOf(piece)).match(/(,\s+|\s+y\s+)$/)?.[0] ?? ' ';
      const last = merged[merged.length - 1];
      // …but only when both sides have their own amount ("heladera en 12 cuotas, 1 palo").
      if (last !== undefined && (!hasAmount(piece) || !hasAmount(last)))
        merged[merged.length - 1] = `${last}${sep}${piece}`;
      else merged.push(piece);
    }
    out.push(...merged.map((p) => p.trim()));
  }
  return out.filter(Boolean);
}

function hasAmount(piece: string) {
  const f = fold(piece);
  return findAmounts(blank(f, [readInstallments(f).span])).length > 0;
}

/** Reads a whole message into draft movements, without any network. */
export function parseMessage(message: string, ctx: ParseContext): CopilotDraft[] {
  return splitMessage(message).map((source) => parsePiece(source, ctx));
}

function parsePiece(source: string, ctx: ParseContext): CopilotDraft {
  const text = fold(source);
  const installments = readInstallments(text);
  const date = readDate(blank(text, [installments.span]), ctx.today);
  const rest = blank(text, [installments.span, date.span]);
  const amount = findAmounts(rest)[0];
  const { hits: named, said } = mentionedAccounts(rest, ctx.accounts);
  const type = readType(rest, named.length);
  const missing: Missing[] = [];
  let confidence = 0.95;

  // Accounts: a transfer goes "de A a B"; anything else uses the one named, or the last used.
  let accountId: string | undefined;
  let toAccountId: string | undefined;
  if (type === 'transfer') {
    const to = named.find((h) => /\b(a|al|hacia|para)\s*$/.test(rest.slice(0, h.span.start)));
    const from = named.find((h) => h !== to) ?? named[0];
    accountId = from?.account.id;
    toAccountId = (to ?? named.find((h) => h !== from))?.account.id;
    if (!toAccountId) missing.push('destination');
  } else {
    accountId = named[0]?.account.id;
  }
  const usable = ctx.accounts.filter((a) => !a.deleted && !a.archived && !a.external);
  const currency = amount?.currency ?? (named[0]?.account.currency === 'USD' ? 'USD' : 'ARS');
  // With a single account there is nothing to choose.
  if (!accountId && usable.length === 1) accountId = usable[0]!.id;
  if (!accountId) {
    // Dollars want a dollar account; otherwise the last one used.
    const fallback =
      currency === 'USD'
        ? usable.find((a) => a.currency === 'USD')
        : (usable.find((a) => a.id === ctx.defaultAccountId && a.currency === 'ARS') ??
          usable.find((a) => a.currency === 'ARS'));
    accountId = fallback?.id;
    confidence -= 0.1;
  }
  let account = usable.find((a) => a.id === accountId);
  // Installments only exist on a credit card: use the user's if none was named.
  if (installments.n && account?.kind !== 'credit') {
    const card = usable.find((a) => a.kind === 'credit');
    if (card && !named.some((h) => h.account.id === account?.id)) {
      accountId = card.id;
      account = card;
    }
  }
  if (!account || account.currency !== currency) missing.push('account');

  const read = type === 'transfer' ? {} : readCategory(source, rest, type, ctx);
  const rule = read.rule;
  let categoryId = read.categoryId;
  if (type === 'income' && !categoryId) {
    // An income with no clear category goes to "Otros", flagged for review.
    categoryId = ctx.categories.find(
      (c) =>
        c.type === 'income' && !c.deleted && !c.archived && CATCH_ALL_INCOME.includes(fold(c.name)),
    )?.id;
    if (categoryId) confidence = Math.min(confidence, 0.6);
  }
  if (type !== 'transfer' && !categoryId) missing.push('category');
  if (rule?.accountId && !named.length && usable.some((a) => a.id === rule.accountId))
    accountId = rule.accountId;
  if (!amount) missing.push('amount');
  confidence -= missing.length * 0.35;

  return {
    type,
    amountCents: amount ? Math.round(amount.value * 100) : 0,
    currency,
    categoryId,
    accountId,
    toAccountId,
    date: date.date,
    installments: installments.n && account?.kind === 'credit' ? installments.n : undefined,
    note: noteOf(source, [
      ...(amount ? [{ start: amount.start, end: amount.end }] : []),
      ...(installments.span ? [installments.span] : []),
      ...(date.span ? [date.span] : []),
      ...said,
    ]),
    tag: rule?.tag,
    confidence: Math.max(0, Math.min(1, Math.round(confidence * 100) / 100)),
    missing,
    source,
  };
}
