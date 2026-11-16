import type { Account } from '../../db/types';

/**
 * Everyday Argentine words → category names. Each entry lists the names it may go by in
 * the user's own categories, first found wins; with none of them, the category stays empty.
 */
export const CATEGORY_WORDS: { words: string[]; names: string[]; type: 'expense' | 'income' }[] = [
  {
    type: 'expense',
    words: [
      'bondi',
      'sube',
      'colectivo',
      'colectivos',
      'uber',
      'cabify',
      'didi',
      'taxi',
      'remis',
      'tren',
      'subte',
      'peaje',
    ],
    names: ['Transporte'],
  },
  {
    type: 'expense',
    words: [
      'birra',
      'birras',
      'cerveza',
      'salida',
      'salidas',
      'bar',
      'boliche',
      'previa',
      'recital',
      'cine',
    ],
    names: ['Salidas'],
  },
  {
    type: 'expense',
    words: [
      'super',
      'supermercado',
      'chino',
      'coto',
      'dia',
      'carrefour',
      'jumbo',
      'disco',
      'vea',
      'changomas',
      'almacen',
      'verduleria',
      'carniceria',
    ],
    names: ['Supermercado'],
  },
  {
    type: 'expense',
    words: ['nafta', 'ypf', 'shell', 'axion', 'combustible', 'gnc'],
    names: ['Combustible', 'Nafta'],
  },
  {
    type: 'expense',
    words: [
      'delivery',
      'rappi',
      'pedidosya',
      'pizza',
      'empanadas',
      'almuerzo',
      'cena',
      'resto',
      'restaurante',
    ],
    names: ['Comida afuera'],
  },
  { type: 'expense', words: ['alquiler'], names: ['Alquiler'] },
  { type: 'expense', words: ['expensas'], names: ['Expensas'] },
  {
    type: 'expense',
    words: ['luz', 'gas', 'agua', 'edenor', 'edesur', 'metrogas', 'aysa'],
    names: ['Servicios'],
  },
  {
    type: 'expense',
    words: ['celular', 'internet', 'fibertel', 'telecentro', 'movistar'],
    names: ['Celular e internet'],
  },
  { type: 'expense', words: ['farmacia', 'remedios', 'medico', 'dentista'], names: ['Salud'] },
  { type: 'expense', words: ['prepaga', 'osde', 'galeno'], names: ['Prepaga'] },
  {
    type: 'expense',
    words: ['netflix', 'spotify', 'disney', 'hbo', 'youtube'],
    names: ['Suscripciones'],
  },
  { type: 'expense', words: ['ropa', 'zapatillas', 'remera', 'jean'], names: ['Ropa'] },
  { type: 'expense', words: ['regalo', 'cumple'], names: ['Regalos'] },
  {
    type: 'expense',
    words: ['heladera', 'lavarropas', 'tele', 'televisor', 'sillon', 'colchon', 'muebles'],
    names: ['Hogar', 'Electrodomésticos'],
  },
  { type: 'expense', words: ['veterinaria', 'alimento balanceado'], names: ['Mascotas'] },
  { type: 'income', words: ['sueldo', 'aguinaldo', 'salario'], names: ['Sueldo'] },
  { type: 'income', words: ['freelance', 'changa'], names: ['Freelance'] },
];

const has = (name: string, word: string) => name.includes(word);

/**
 * Words that point to an account. `pick` chooses among the user's accounts; a name match
 * ("naranja" in "Naranja X") always comes first.
 */
export const ACCOUNT_WORDS: { words: string[]; pick: (a: Account, name: string) => boolean }[] = [
  {
    words: ['mercado pago', 'mercadopago', 'mp'],
    pick: (a, n) => has(n, 'mercado pago') || a.kind === 'wallet',
  },
  { words: ['naranja x', 'la naranja', 'naranja'], pick: (_a, n) => has(n, 'naranja') },
  {
    words: ['visa', 'mastercard', 'master', 'amex', 'tarjeta', 'credito'],
    pick: (a) => a.kind === 'credit',
  },
  { words: ['efectivo', 'cash', 'en mano'], pick: (a) => a.kind === 'cash' },
  { words: ['banco', 'debito', 'cuenta'], pick: (a) => a.kind === 'bank' },
];

export const INCOME_WORDS = [
  'cobre',
  'cobro',
  'cobramos',
  'me pagaron',
  'me pago',
  'me pagan',
  'vendi',
  'vendimos',
  'me devolvieron',
  'me transfirieron',
  'me depositaron',
  'me debia',
  'me debian',
  'gane',
];
export const TRANSFER_WORDS = ['pase', 'pasamos', 'transferi', 'movi', 'mande'];
export const EXPENSE_WORDS = ['gaste', 'pague', 'compre', 'gastamos', 'pagamos'];
