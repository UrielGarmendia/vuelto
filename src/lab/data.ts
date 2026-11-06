// Sample month for the design lab only: November 2026 seen on the 22nd.

export type Kind = 'expense' | 'income';

export interface LabCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export interface LabAccount {
  id: string;
  name: string;
  kind: 'cash' | 'bank' | 'wallet' | 'credit';
  initial: number; // cents
}

export interface LabTx {
  day: number;
  kind: Kind;
  cat: string;
  note: string;
  amount: number; // cents, positive
  account: string;
}

export const today = {
  day: 22,
  daysInMonth: 30,
  monthName: 'noviembre',
  label: 'Domingo 22 de noviembre',
};

export const categories: Record<string, LabCategory> = {
  alquiler: { id: 'alquiler', name: 'Alquiler', icon: 'house', color: '#8C5E3C' },
  expensas: { id: 'expensas', name: 'Expensas', icon: 'building-2', color: '#9C7A5B' },
  super: { id: 'super', name: 'Supermercado', icon: 'shopping-cart', color: '#E0894E' },
  transporte: { id: 'transporte', name: 'Transporte', icon: 'bus', color: '#4C7EA8' },
  prepaga: { id: 'prepaga', name: 'Prepaga', icon: 'stethoscope', color: '#B85C6E' },
  celular: { id: 'celular', name: 'Celular e internet', icon: 'wifi', color: '#5A8FBF' },
  comida: { id: 'comida', name: 'Comida afuera', icon: 'utensils', color: '#C94A40' },
  nafta: { id: 'nafta', name: 'Nafta', icon: 'fuel', color: '#6B6F7A' },
  salidas: { id: 'salidas', name: 'Salidas', icon: 'ticket', color: '#A45FA0' },
  servicios: { id: 'servicios', name: 'Servicios', icon: 'lightbulb', color: '#D6A933' },
  suscripciones: { id: 'suscripciones', name: 'Suscripciones', icon: 'repeat', color: '#7A6BC2' },
  salud: { id: 'salud', name: 'Salud', icon: 'pill', color: '#3E9C8A' },
  sueldo: { id: 'sueldo', name: 'Sueldo', icon: 'briefcase', color: '#2F8F62' },
  freelance: { id: 'freelance', name: 'Freelance', icon: 'laptop', color: '#3E9C8A' },
};

export const accounts: LabAccount[] = [
  { id: 'efectivo', name: 'Efectivo', kind: 'cash', initial: 8500000 },
  { id: 'banco', name: 'Banco', kind: 'bank', initial: 60000000 },
  { id: 'mp', name: 'Mercado Pago', kind: 'wallet', initial: 22000000 },
  { id: 'visa', name: 'Visa', kind: 'credit', initial: 0 },
];

const $ = (pesos: number) => Math.round(pesos * 100);

export const txs: LabTx[] = [
  {
    day: 1,
    kind: 'income',
    cat: 'sueldo',
    note: 'Sueldo octubre',
    amount: $(1850000),
    account: 'banco',
  },
  {
    day: 1,
    kind: 'expense',
    cat: 'alquiler',
    note: 'Alquiler',
    amount: $(520000),
    account: 'banco',
  },
  {
    day: 3,
    kind: 'expense',
    cat: 'expensas',
    note: 'Expensas',
    amount: $(98500),
    account: 'banco',
  },
  { day: 4, kind: 'expense', cat: 'super', note: 'Coto', amount: $(64320), account: 'visa' },
  {
    day: 5,
    kind: 'expense',
    cat: 'transporte',
    note: 'Carga SUBE',
    amount: $(15000),
    account: 'mp',
  },
  { day: 6, kind: 'expense', cat: 'prepaga', note: 'Prepaga', amount: $(162400), account: 'banco' },
  {
    day: 7,
    kind: 'expense',
    cat: 'celular',
    note: 'Fibra y celular',
    amount: $(38900),
    account: 'visa',
  },
  { day: 8, kind: 'expense', cat: 'comida', note: 'Pizzería', amount: $(27600), account: 'mp' },
  { day: 9, kind: 'expense', cat: 'nafta', note: 'YPF', amount: $(45000), account: 'visa' },
  { day: 11, kind: 'expense', cat: 'super', note: 'Día', amount: $(23780), account: 'mp' },
  {
    day: 12,
    kind: 'income',
    cat: 'freelance',
    note: 'Diseño de logo',
    amount: $(240000),
    account: 'mp',
  },
  { day: 12, kind: 'expense', cat: 'salidas', note: 'Cine', amount: $(18000), account: 'efectivo' },
  { day: 14, kind: 'expense', cat: 'servicios', note: 'Luz', amount: $(31240), account: 'banco' },
  { day: 15, kind: 'expense', cat: 'comida', note: 'Sushi', amount: $(42800), account: 'visa' },
  { day: 16, kind: 'expense', cat: 'super', note: 'Coto', amount: $(71560), account: 'visa' },
  {
    day: 18,
    kind: 'expense',
    cat: 'suscripciones',
    note: 'Spotify y Netflix',
    amount: $(19300),
    account: 'visa',
  },
  {
    day: 19,
    kind: 'expense',
    cat: 'transporte',
    note: 'Carga SUBE',
    amount: $(15000),
    account: 'mp',
  },
  { day: 20, kind: 'expense', cat: 'comida', note: 'Café', amount: $(6400), account: 'mp' },
  { day: 21, kind: 'expense', cat: 'salud', note: 'Farmacia', amount: $(22150), account: 'mp' },
  {
    day: 22,
    kind: 'expense',
    cat: 'super',
    note: 'Verdulería',
    amount: $(12890),
    account: 'efectivo',
  },
  { day: 22, kind: 'expense', cat: 'comida', note: 'Almuerzo', amount: $(14500), account: 'mp' },
];

/** October, per category, for the month-over-month comparisons. */
export const lastMonth: Record<string, number> = {
  alquiler: $(520000),
  super: $(181200),
  prepaga: $(154000),
  expensas: $(95000),
  comida: $(74300),
  nafta: $(52000),
  servicios: $(41500),
  celular: $(38900),
  salidas: $(31000),
  transporte: $(26000),
  suscripciones: $(19300),
  salud: $(18800),
};
export const budget = $(1500000);

// Derived figures: every total on screen comes from the rows above.
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
export const spent = sum(txs.filter((t) => t.kind === 'expense').map((t) => t.amount));
export const earned = sum(txs.filter((t) => t.kind === 'income').map((t) => t.amount));

export const balances = Object.fromEntries(
  accounts.map((a) => [
    a.id,
    a.initial +
      sum(
        txs
          .filter((t) => t.account === a.id)
          .map((t) => (t.kind === 'income' ? t.amount : -t.amount)),
      ),
  ]),
) as Record<string, number>;

export const total = sum(Object.values(balances));
export const cardDebt = -Math.min(0, balances.visa!);
export const available = total + cardDebt;

/** At today's pace, money left at the end of the month. */
export const projectedSpend = Math.round(((spent / today.day) * today.daysInMonth) / 100) * 100;
export const projectedLeft = total + spent - projectedSpend;
export const overBudget = projectedSpend - budget;

export const byCategory = Object.entries(
  txs
    .filter((t) => t.kind === 'expense')
    .reduce<Record<string, number>>((m, t) => ({ ...m, [t.cat]: (m[t.cat] ?? 0) + t.amount }), {}),
)
  .map(([cat, cents]) => ({ cat, cents }))
  .sort((a, b) => b.cents - a.cents);

export const daily = Array.from({ length: today.daysInMonth }, (_, i) =>
  sum(txs.filter((t) => t.kind === 'expense' && t.day === i + 1).map((t) => t.amount)),
);

const comidaNow = byCategory.find((c) => c.cat === 'comida')!.cents;
export const insight = {
  cat: 'comida',
  pct: Math.round(((comidaNow - lastMonth.comida!) / lastMonth.comida!) * 100),
  now: comidaNow,
  before: lastMonth.comida!,
};

export const recent = [...txs].reverse().slice(0, 5);

/** Spending of the eleven previous months, oldest first; October comes from its categories. */
export const history: { label: string; days: number; cents: number }[] = [
  { label: 'dic', days: 31, cents: $(1180000) },
  { label: 'ene', days: 31, cents: $(1050000) },
  { label: 'feb', days: 28, cents: $(980000) },
  { label: 'mar', days: 31, cents: $(1120000) },
  { label: 'abr', days: 30, cents: $(1150000) },
  { label: 'may', days: 31, cents: $(1210000) },
  { label: 'jun', days: 30, cents: $(1190000) },
  { label: 'jul', days: 31, cents: $(1330000) },
  { label: 'ago', days: 31, cents: $(1290000) },
  { label: 'sep', days: 30, cents: $(1360000) },
  { label: 'oct', days: 31, cents: Object.values(lastMonth).reduce((a, b) => a + b, 0) },
];

/** Running total of spending at the end of each day of the month. */
export const cumulative = daily.reduce<number[]>((acc, c) => [...acc, (acc.at(-1) ?? 0) + c], []);

// The figures that must agree, checked when the lab loads.
const checks: [boolean, string][] = [
  [sum(byCategory.map((c) => c.cents)) === spent, 'categories add up to spent'],
  [sum(daily) === spent, 'days add up to spent'],
  [available - cardDebt === total, 'available minus card debt is the total'],
  [
    balances.visa === -sum(txs.filter((t) => t.account === 'visa').map((t) => t.amount)),
    'card debt is its charges',
  ],
];
for (const [ok, what] of checks) if (!ok) console.error(`lab data: ${what} failed`);
