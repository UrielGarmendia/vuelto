import { db as defaultDb, newMeta, type VueltoDB } from '../../db/db';
import type { Rule } from '../../db/types';

/** Lowercase, no accents, single spaces: "Café  Martínez" → "cafe martinez". */
export const plain = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/** The first enabled rule, in the user's order, whose text appears in `text`. */
export function matchRule(text: string, rules: readonly Rule[]): Rule | undefined {
  const t = plain(text);
  if (!t) return undefined;
  return [...rules]
    .filter((r) => r.enabled && !r.deleted && plain(r.match))
    .sort((a, b) => a.order - b.order)
    .find((r) => t.includes(plain(r.match)));
}

/** Words that say nothing about what a movement was. */
const STOP_WORDS = new Set([
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
]);

/**
 * The word a learned rule should look for: the first one in the note that is not a stop
 * word or a number. Nothing under three letters is ever proposed.
 */
export function ruleKeyword(note: string | undefined): string | undefined {
  const words = plain(note ?? '')
    .replace(/#\S+/g, ' ')
    .split(/[^a-z0-9ñ]+/)
    .filter((w) => w && !STOP_WORDS.has(w) && !/^\d+$/.test(w));
  const word = words[0];
  return word && word.length >= 3 ? word : undefined;
}

export type RuleDraft = Pick<Rule, 'match' | 'categoryId' | 'accountId' | 'tag'> & {
  enabled?: 0 | 1;
};

export async function saveRule(
  draft: RuleDraft,
  id?: string,
  db: VueltoDB = defaultDb,
): Promise<string> {
  const now = Date.now();
  const clean = {
    match: draft.match.trim(),
    categoryId: draft.categoryId,
    accountId: draft.accountId || undefined,
    tag: draft.tag?.replace(/^#/, '').trim() || undefined,
    enabled: draft.enabled ?? 1,
  };
  if (id) {
    await db.rules.update(id, { ...clean, updatedAt: now, synced: 0 });
    return id;
  }
  const row: Rule = { ...newMeta(now), ...clean, order: await db.rules.count() };
  await db.rules.add(row);
  return row.id;
}

export const deleteRule = (id: string, db: VueltoDB = defaultDb) =>
  db.rules.update(id, { deleted: 1, updatedAt: Date.now(), synced: 0 });
