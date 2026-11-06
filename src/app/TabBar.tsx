import { ChartPie, House, ReceiptText, Plus, Settings } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { NavLink } from 'react-router';
import { useTxSheet } from '../features/transactions/store';
import { viewTransitions } from './viewTransitions';

const tabs: { to: string; label: string; icon: LucideIcon }[] = [
  { to: '/', label: 'Inicio', icon: House },
  { to: '/movimientos', label: 'Movimientos', icon: ReceiptText },
  { to: '/estadisticas', label: 'Estadísticas', icon: ChartPie },
  { to: '/ajustes', label: 'Ajustes', icon: Settings },
];

function Tab({ to, label, icon: Icon }: (typeof tabs)[number]) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      viewTransition={viewTransitions}
      className={({ isActive }) =>
        `flex min-h-12 flex-1 flex-col items-center justify-center gap-1 rounded-sm text-[11px] font-medium transition-colors duration-150 ${
          isActive ? 'text-ink' : 'text-muted'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon aria-hidden className="size-[22px]" strokeWidth={isActive ? 2.25 : 1.75} />
          {label}
        </>
      )}
    </NavLink>
  );
}

export function TabBar() {
  const openNew = useTxSheet((s) => s.openNew);
  return (
    <nav
      id="tabbar"
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg/85 pb-safe backdrop-blur-xl"
    >
      <div className="mx-auto flex max-w-lg items-center px-2 pt-1.5 pb-1.5">
        <Tab {...tabs[0]!} />
        <Tab {...tabs[1]!} />
        <div className="flex flex-1 justify-center">
          <button
            type="button"
            onClick={openNew}
            aria-label="Cargar movimiento"
            className="grid size-14 -translate-y-1 place-items-center rounded-full bg-accent text-on-accent shadow-[0_8px_20px_-6px_rgb(217_101_59/0.6)] transition-transform active:scale-95"
          >
            <Plus aria-hidden className="size-7" strokeWidth={2.25} />
          </button>
        </div>
        <Tab {...tabs[2]!} />
        <Tab {...tabs[3]!} />
      </div>
    </nav>
  );
}
