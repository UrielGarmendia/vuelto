import { Plus } from 'lucide-react';
import { NavLink } from 'react-router';
import { useTxSheet } from '../features/transactions/store';
import { sections } from './nav';
import { viewTransitions } from './viewTransitions';

function Tab({ to, label, icon: Icon }: (typeof sections)[number]) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      viewTransition={viewTransitions}
      className={({ isActive }) =>
        `flex min-h-12 flex-col items-center justify-center gap-1 rounded-sm text-[11px] font-medium transition-colors duration-150 ${
          isActive ? 'text-ink' : 'text-faint'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon aria-hidden className="size-[22px]" strokeWidth={isActive ? 2.2 : 1.7} />
          {label}
        </>
      )}
    </NavLink>
  );
}

/** Phone and tablet navigation; on wide screens the sidebar takes over. */
export function TabBar() {
  const openNew = useTxSheet((s) => s.openNew);
  return (
    <nav
      id="tabbar"
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-ground pb-safe lg:hidden"
    >
      <div className="mx-auto grid max-w-xl grid-cols-5 items-center px-2 pt-1.5 pb-2">
        <Tab {...sections[0]!} />
        <Tab {...sections[1]!} />
        <button
          type="button"
          onClick={openNew}
          aria-label="Cargar movimiento"
          className="rel go mx-auto -mt-4 grid size-[58px] place-items-center rounded-[20px]"
        >
          <Plus aria-hidden className="size-7" strokeWidth={2.4} />
        </button>
        <Tab {...sections[2]!} />
        <Tab {...sections[3]!} />
      </div>
    </nav>
  );
}
