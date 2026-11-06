import { ChartPie, House, ReceiptText, Settings, type LucideIcon } from 'lucide-react';
import { useNavigate } from 'react-router';
import { viewTransitions } from './viewTransitions';

export const sections: { to: string; label: string; icon: LucideIcon }[] = [
  { to: '/', label: 'Inicio', icon: House },
  { to: '/movimientos', label: 'Movimientos', icon: ReceiptText },
  { to: '/estadisticas', label: 'Estadísticas', icon: ChartPie },
  { to: '/ajustes', label: 'Ajustes', icon: Settings },
];

/** Opens Movimientos with the search box focused (the `/` shortcut does the same). */
export function useOpenSearch() {
  const navigate = useNavigate();
  return () =>
    navigate('/movimientos', {
      state: { focusSearch: Date.now() },
      viewTransition: viewTransitions,
    });
}
