import { describe, expect, it } from 'vitest';
import { newMeta } from '../../db/db';
import type { Account, Category, Rule } from '../../db/types';
import { parseMessage, splitMessage, type ParseContext } from './parse';

const cat = (name: string, type: 'expense' | 'income' = 'expense'): Category => ({
  ...newMeta(0),
  id: name,
  name,
  type,
  icon: 'x',
  color: '#000',
  order: 0,
  archived: 0,
});
const acc = (name: string, kind: Account['kind'], currency: 'ARS' | 'USD' = 'ARS'): Account => ({
  ...newMeta(0),
  id: name,
  name,
  kind,
  currency,
  initialBalanceCents: 0,
  color: '#000',
  order: 0,
  archived: 0,
});

// The default categories and accounts of a new install. Monday 16 November 2026.
const ctx: ParseContext = {
  categories: [
    ...[
      'Supermercado',
      'Comida afuera',
      'Transporte',
      'Nafta',
      'Salidas',
      'Hogar',
      'Servicios',
    ].map((n) => cat(n)),
    cat('Sueldo', 'income'),
    cat('Otros', 'income'),
  ],
  accounts: [
    acc('Efectivo', 'cash'),
    acc('Banco', 'bank'),
    acc('Mercado Pago', 'wallet'),
    acc('Tarjeta de crédito', 'credit'),
  ],
  rules: [],
  today: '2026-11-16',
  defaultAccountId: 'Banco',
};

const one = (text: string, c: ParseContext = ctx) => {
  const all = parseMessage(text, c);
  expect(all).toHaveLength(1);
  return all[0]!;
};

describe('the copilot examples', () => {
  it('gasté 800 en el bondi', () => {
    expect(one('gasté 800 en el bondi')).toMatchObject({
      type: 'expense',
      amountCents: 80_000,
      categoryId: 'Transporte',
      date: '2026-11-16',
      note: 'Bondi',
      missing: [],
    });
  });

  it('vendí un escape por 350000', () => {
    expect(one('vendí un escape por 350000')).toMatchObject({
      type: 'income',
      amountCents: 35_000_000,
      note: 'Escape',
    });
  });

  it('super 23 lucas con mp', () => {
    expect(one('super 23 lucas con mp')).toMatchObject({
      type: 'expense',
      amountCents: 2_300_000,
      categoryId: 'Supermercado',
      accountId: 'Mercado Pago',
      missing: [],
    });
  });

  it('ayer birra con los pibes 12k en efectivo', () => {
    expect(one('ayer birra con los pibes 12k en efectivo')).toMatchObject({
      type: 'expense',
      amountCents: 1_200_000,
      categoryId: 'Salidas',
      accountId: 'Efectivo',
      date: '2026-11-15',
      note: 'Birra con los pibes',
    });
  });

  it('heladera en 12 cuotas, 1 palo y medio con la visa', () => {
    expect(one('heladera en 12 cuotas, 1 palo y medio con la visa')).toMatchObject({
      type: 'expense',
      amountCents: 150_000_000,
      installments: 12,
      accountId: 'Tarjeta de crédito',
      categoryId: 'Hogar',
      note: 'Heladera',
    });
  });

  it('cobré el sueldo, 2,3 palos', () => {
    expect(one('cobré el sueldo, 2,3 palos')).toMatchObject({
      type: 'income',
      amountCents: 230_000_000,
      categoryId: 'Sueldo',
    });
  });

  it('pasé 50 lucas de mp al banco', () => {
    expect(one('pasé 50 lucas de mp al banco')).toMatchObject({
      type: 'transfer',
      amountCents: 5_000_000,
      accountId: 'Mercado Pago',
      toAccountId: 'Banco',
      missing: [],
    });
  });

  it('nafta 35 lucas y sube 2 lucas', () => {
    const [a, b] = parseMessage('nafta 35 lucas y sube 2 lucas', ctx);
    expect(a).toMatchObject({ amountCents: 3_500_000, categoryId: 'Nafta' });
    expect(b).toMatchObject({ amountCents: 200_000, categoryId: 'Transporte' });
  });

  it('100 verdes que me debía juan', () => {
    const d = one('100 verdes que me debía juan');
    expect(d).toMatchObject({ type: 'income', amountCents: 10_000, currency: 'USD' });
    // No dollar account yet: the card asks for one.
    expect(d.missing).toContain('account');
    const withUsd = one('100 verdes que me debía juan', {
      ...ctx,
      accounts: [...ctx.accounts, acc('Dólares', 'cash', 'USD')],
    });
    expect(withUsd).toMatchObject({ accountId: 'Dólares', currency: 'USD' });
  });
});

describe('the dictionary', () => {
  it.each([
    ['colectivo 700', 'Transporte'],
    ['uber 4500', 'Transporte'],
    ['bar 9000', 'Salidas'],
    ['salida 15 lucas', 'Salidas'],
    ['chino 3 lucas', 'Supermercado'],
    ['coto 40k', 'Supermercado'],
    ['dia 8000', 'Supermercado'],
    ['ypf 30 lucas', 'Nafta'],
    ['shell 25k', 'Nafta'],
  ])('%s → %s', (text, category) => {
    expect(one(text).categoryId).toBe(category);
  });

  it('maps to the user’s own names, and leaves the category empty if there is none', () => {
    const withFuel = { ...ctx, categories: [...ctx.categories, cat('Combustible')] };
    expect(one('nafta 10k', withFuel).categoryId).toBe('Combustible');
    const without = { ...ctx, categories: ctx.categories.filter((c) => c.name !== 'Salidas') };
    const d = one('birra 5k', without);
    expect(d.categoryId).toBeUndefined();
    expect(d.missing).toContain('category');
    expect(d.confidence).toBeLessThan(0.7);
  });

  it('knows accounts by their usual names', () => {
    const naranja = { ...ctx, accounts: [...ctx.accounts, acc('Naranja X', 'credit')] };
    expect(one('zapatillas 80k con la naranja', naranja).accountId).toBe('Naranja X');
    expect(one('remera 20k con naranja x', naranja).accountId).toBe('Naranja X');
    expect(one('coto 10k con la master').accountId).toBe('Tarjeta de crédito');
    expect(one('coto 10k cash').accountId).toBe('Efectivo');
    expect(one('coto 10k con mercado pago').accountId).toBe('Mercado Pago');
    // Not named: the last one used.
    expect(one('coto 10k').accountId).toBe('Banco');
  });

  it('reads me pagaron / cobré / vendí as income', () => {
    expect(one('me pagaron 50 lucas').type).toBe('income');
    expect(one('cobré 100k').type).toBe('income');
    expect(one('vendí la bici 200k').type).toBe('income');
  });
});

describe('dates', () => {
  it.each([
    ['ayer super 5k', '2026-11-15'],
    ['anteayer super 5k', '2026-11-14'],
    ['el viernes super 5k', '2026-11-13'],
    ['el lunes super 5k', '2026-11-16'],
    ['el 3 super 5k', '2026-11-03'],
    ['el 20 super 5k', '2026-10-20'],
    ['super 5k', '2026-11-16'],
  ])('%s → %s', (text, date) => {
    expect(one(text)).toMatchObject({ date, amountCents: 500_000 });
  });
});

describe('splitting a message', () => {
  it('splits on "y", commas and new lines only between movements', () => {
    expect(splitMessage('nafta 35 lucas y sube 2 lucas')).toEqual([
      'nafta 35 lucas',
      'sube 2 lucas',
    ]);
    expect(splitMessage('coto 10k, farmacia 5k\nuber 3k')).toEqual([
      'coto 10k',
      'farmacia 5k',
      'uber 3k',
    ]);
    expect(splitMessage('heladera en 12 cuotas, 1 palo y medio')).toEqual([
      'heladera en 12 cuotas, 1 palo y medio',
    ]);
    expect(splitMessage('pan y leche 3 lucas')).toEqual(['pan y leche 3 lucas']);
    expect(splitMessage('una luca y media de pan')).toEqual(['una luca y media de pan']);
  });
});

describe('rules come first', () => {
  it('a rule beats the dictionary and brings its account and tag', () => {
    const rule: Rule = {
      ...newMeta(0),
      match: 'uber',
      categoryId: 'Salidas',
      accountId: 'Mercado Pago',
      tag: 'joda',
      order: 0,
      enabled: 1,
    };
    expect(one('uber 4500', { ...ctx, rules: [rule] })).toMatchObject({
      categoryId: 'Salidas',
      accountId: 'Mercado Pago',
      tag: 'joda',
    });
  });

  it('marks what it could not read', () => {
    const d = one('algo raro');
    expect(d.missing).toEqual(expect.arrayContaining(['amount', 'category']));
    expect(d.confidence).toBeLessThan(0.7);
  });
});
