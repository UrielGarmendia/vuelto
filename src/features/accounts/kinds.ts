import { Banknote, CreditCard, Landmark, Smartphone, type LucideIcon } from 'lucide-react';
import type { AccountKind } from '../../db/types';

export const accountKinds: Record<AccountKind, { label: string; icon: LucideIcon }> = {
  cash: { label: 'Efectivo', icon: Banknote },
  bank: { label: 'Banco', icon: Landmark },
  wallet: { label: 'Billetera virtual', icon: Smartphone },
  credit: { label: 'Tarjeta de crédito', icon: CreditCard },
};

/** Dark or light text, whichever reads better (WCAG relative luminance) on a solid color. */
export function textOn(hex: string): '#1C1A17' | '#FFFFFF' {
  const lin = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const l = 0.2126 * lin[0]! + 0.7152 * lin[1]! + 0.0722 * lin[2]!;
  // Contrast with white vs. with near-black ink; pick the higher.
  const withWhite = 1.05 / (l + 0.05);
  const withInk = (l + 0.05) / 0.0617;
  return withWhite >= withInk ? '#FFFFFF' : '#1C1A17';
}
