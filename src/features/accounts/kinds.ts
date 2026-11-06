import { Banknote, CreditCard, Landmark, Smartphone, type LucideIcon } from 'lucide-react';
import type { AccountKind } from '../../db/types';

export const accountKinds: Record<AccountKind, { label: string; icon: LucideIcon }> = {
  cash: { label: 'Efectivo', icon: Banknote },
  bank: { label: 'Banco', icon: Landmark },
  wallet: { label: 'Billetera virtual', icon: Smartphone },
  credit: { label: 'Tarjeta de crédito', icon: CreditCard },
};
