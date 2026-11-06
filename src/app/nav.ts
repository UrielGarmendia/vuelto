import { ChartPie, House, ReceiptText, Settings, type LucideIcon } from 'lucide-react';
import { create } from 'zustand';

export const sections: { to: string; label: string; icon: LucideIcon }[] = [
  { to: '/', label: 'Inicio', icon: House },
  { to: '/movimientos', label: 'Movimientos', icon: ReceiptText },
  { to: '/estadisticas', label: 'Estadísticas', icon: ChartPie },
  { to: '/ajustes', label: 'Ajustes', icon: Settings },
];

/** The global search box (Ctrl+K, / or the search button). */
export const useSearch = create<{ open: boolean; set: (open: boolean) => void }>()((set) => ({
  open: false,
  set: (open) => set({ open }),
}));
