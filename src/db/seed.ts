import type { Transaction as DexieTx } from 'dexie';
import type { Account, Category, Meta } from './types';

type Seed<T> = Omit<T, keyof Meta | 'order' | 'archived'>;

const expenseCategories: Seed<Category>[] = [
  { name: 'Supermercado', icon: 'shopping-cart', color: '#D9653B', type: 'expense' },
  { name: 'Comida afuera', icon: 'utensils', color: '#E0894E', type: 'expense' },
  { name: 'Transporte', icon: 'bus', color: '#4C7EA8', type: 'expense' },
  { name: 'Nafta', icon: 'fuel', color: '#6B6F7A', type: 'expense' },
  { name: 'Alquiler', icon: 'house', color: '#8C5E3C', type: 'expense' },
  { name: 'Expensas', icon: 'building-2', color: '#9C7A5B', type: 'expense' },
  { name: 'Servicios', icon: 'lightbulb', color: '#D6A933', type: 'expense' },
  { name: 'Celular e internet', icon: 'wifi', color: '#5A8FBF', type: 'expense' },
  { name: 'Salud', icon: 'heart-pulse', color: '#C94A40', type: 'expense' },
  { name: 'Prepaga', icon: 'stethoscope', color: '#B85C6E', type: 'expense' },
  { name: 'Educación', icon: 'graduation-cap', color: '#5B6BB5', type: 'expense' },
  { name: 'Ropa', icon: 'shirt', color: '#A45FA0', type: 'expense' },
  { name: 'Salidas', icon: 'party-popper', color: '#E06C8C', type: 'expense' },
  { name: 'Suscripciones', icon: 'repeat', color: '#7A6BC2', type: 'expense' },
  { name: 'Regalos', icon: 'gift', color: '#D2554A', type: 'expense' },
  { name: 'Mascotas', icon: 'paw-print', color: '#9A7B4F', type: 'expense' },
  { name: 'Hogar', icon: 'sofa', color: '#6E8B6B', type: 'expense' },
  { name: 'Impuestos', icon: 'landmark', color: '#7D7469', type: 'expense' },
];

const incomeCategories: Seed<Category>[] = [
  { name: 'Sueldo', icon: 'briefcase', color: '#2F8F62', type: 'income' },
  { name: 'Freelance', icon: 'laptop', color: '#3E9C8A', type: 'income' },
  { name: 'Otros', icon: 'coins', color: '#6FA36B', type: 'income' },
];

const accounts: Seed<Account>[] = [
  { name: 'Efectivo', kind: 'cash', currency: 'ARS', initialBalanceCents: 0, color: '#6E8B6B' },
  { name: 'Banco', kind: 'bank', currency: 'ARS', initialBalanceCents: 0, color: '#4C7EA8' },
  {
    name: 'Mercado Pago',
    kind: 'wallet',
    currency: 'ARS',
    initialBalanceCents: 0,
    color: '#3BA7D9',
  },
  {
    name: 'Tarjeta de crédito',
    kind: 'credit',
    currency: 'ARS',
    initialBalanceCents: 0,
    color: '#7A6BC2',
  },
];

export async function seed(tx: DexieTx): Promise<void> {
  const now = Date.now();
  const meta = () => ({
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    deleted: 0,
    synced: 0,
  });
  await tx.table('categories').bulkAdd(
    [...expenseCategories, ...incomeCategories].map((c, order) => ({
      ...meta(),
      ...c,
      order,
      archived: 0,
    })),
  );
  await tx
    .table('accounts')
    .bulkAdd(accounts.map((a, order) => ({ ...meta(), ...a, order, archived: 0 })));
}
