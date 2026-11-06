import { NavLink } from 'react-router';
import { Wordmark } from '../ui/Wordmark';
import { sections } from './nav';
import { viewTransitions } from './viewTransitions';

/** Wide-screen navigation (≥1024 px). */
export function Sidebar() {
  return (
    <nav
      aria-label="Principal"
      className="fixed inset-y-0 left-0 z-20 hidden w-[232px] flex-col border-r border-line bg-ground px-3 pt-safe lg:flex"
    >
      <div className="flex h-16 items-center px-3">
        <Wordmark />
      </div>
      <ul className="mt-2 space-y-1">
        {sections.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={to === '/'}
              viewTransition={viewTransitions}
              className={({ isActive }) =>
                `hoverable flex min-h-10 items-center gap-3 rounded-[12px] px-3 text-[14.5px] font-medium transition-colors ${
                  isActive ? 'bg-flat text-ink' : 'text-faint hover:text-ink'
                }`
              }
            >
              <Icon aria-hidden className="size-[18px]" />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
      <p className="mt-auto px-3 pb-6 text-[12.5px] leading-relaxed text-faint">
        Atajos: <kbd className="font-sans text-muted">N</kbd> nuevo,{' '}
        <kbd className="font-sans text-muted">/</kbd> buscar,{' '}
        <kbd className="font-sans text-muted">Esc</kbd> cerrar
      </p>
    </nav>
  );
}
