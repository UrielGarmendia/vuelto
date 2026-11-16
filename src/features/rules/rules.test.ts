import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { newMeta, VueltoDB } from '../../db/db';
import type { Rule } from '../../db/types';
import { matchRule, plain, ruleKeyword, saveRule } from './rules';

const rule = (match: string, categoryId: string, order: number, enabled: 0 | 1 = 1): Rule => ({
  ...newMeta(0),
  match,
  categoryId,
  order,
  enabled,
});

describe('matchRule', () => {
  const rules = [
    rule('uber eats', 'comida', 1),
    rule('Uber', 'transporte', 2),
    rule('café', 'salidas', 0, 0),
    rule('cafe', 'cafe', 3),
  ];

  it('finds the text anywhere, ignoring case and accents, first rule in order wins', () => {
    expect(matchRule('Uber al centro', rules)?.categoryId).toBe('transporte');
    expect(matchRule('pedido UBER EATS', rules)?.categoryId).toBe('comida');
    expect(matchRule('Café Martínez', rules)?.categoryId).toBe('cafe');
    expect(matchRule('nada que ver', rules)).toBeUndefined();
    expect(matchRule('   ', rules)).toBeUndefined();
    expect(plain('  Café   Martínez ')).toBe('cafe martinez');
  });
});

describe('ruleKeyword', () => {
  it('skips stop words, numbers and tags, and never proposes under three letters', () => {
    expect(ruleKeyword('Uber al centro')).toBe('uber');
    expect(ruleKeyword('con la birra de los pibes')).toBe('birra');
    expect(ruleKeyword('para el bondi')).toBe('bondi');
    expect(ruleKeyword('#amigos Coto 2000')).toBe('coto');
    expect(ruleKeyword('YPF')).toBe('ypf');
    expect(ruleKeyword('mp')).toBeUndefined();
    expect(ruleKeyword('de la y en a')).toBeUndefined();
    expect(ruleKeyword('')).toBeUndefined();
    expect(ruleKeyword(undefined)).toBeUndefined();
  });
});

describe('saveRule', () => {
  let db: VueltoDB;
  beforeEach(async () => {
    db = new VueltoDB(`rules-${crypto.randomUUID()}`);
    await db.open();
  });
  afterEach(() => db.delete());

  it('adds rules at the end, cleans the tag and edits in place', async () => {
    const a = await saveRule({ match: ' uber ', categoryId: 't' }, undefined, db);
    const b = await saveRule({ match: 'birra', categoryId: 's', tag: '#amigos' }, undefined, db);
    expect(await db.rules.get(a)).toMatchObject({ match: 'uber', order: 0, enabled: 1 });
    expect(await db.rules.get(b)).toMatchObject({ order: 1, tag: 'amigos' });
    await saveRule({ match: 'cabify', categoryId: 't', enabled: 0 }, a, db);
    expect(await db.rules.get(a)).toMatchObject({ match: 'cabify', enabled: 0, synced: 0 });
  });
});
