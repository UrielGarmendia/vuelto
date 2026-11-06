import { useState } from 'react';
import {
  amountInputToCents,
  applyAmountKey,
  formatAmountInput,
  type AmountKey,
} from '../lib/amountInput';
import { formatMoney } from '../lib/money';
import { categories } from './data';

export const keys: AmountKey[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', 'back'];
export const keyLabel = (k: AmountKey) =>
  k === 'back' ? 'Borrar' : k === ',' ? 'Coma decimal' : k;

/** Draft state for the lab's entry sheet; starts with a realistic amount so screenshots are full. */
export function useEntry(initial = '18450') {
  const [input, setInput] = useState(initial);
  const [cat, setCat] = useState('super');
  return {
    input,
    cents: amountInputToCents(input),
    display: formatAmountInput(input),
    press: (k: AmountKey) => setInput((s) => applyAmountKey(s, k)),
    cat,
    setCat,
  };
}

export const sheetCategories = [
  'super',
  'comida',
  'transporte',
  'salidas',
  'nafta',
  'servicios',
  'salud',
  'suscripciones',
].map((id) => categories[id]!);

/** Signed money with a true minus sign, matching the movement rows. */
export const signed = (cents: number) =>
  cents < 0 ? `−${formatMoney(-cents)}` : formatMoney(cents);
