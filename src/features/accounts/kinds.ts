import {
  Banknote,
  CreditCard,
  Landmark,
  Smartphone,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import type { AccountKind } from '../../db/types';

export const accountKinds: Record<AccountKind, { label: string; icon: LucideIcon }> = {
  cash: { label: 'Efectivo', icon: Banknote },
  bank: { label: 'Banco', icon: Landmark },
  wallet: { label: 'Billetera virtual', icon: Smartphone },
  credit: { label: 'Tarjeta de crédito', icon: CreditCard },
  investment: { label: 'Inversiones', icon: TrendingUp },
};

/** Kinds the user creates by hand; investment accounts come from a linked service. */
export const manualKinds = ['cash', 'bank', 'wallet', 'credit'] as const;
