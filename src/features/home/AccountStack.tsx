import { ChevronDown } from 'lucide-react';
import { m } from 'motion/react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { viewTransitions } from '../../app/viewTransitions';
import type { Account } from '../../db/types';
import { formatMoney } from '../../lib/money';
import { spring } from '../../ui/motion';
import { accountKinds } from '../accounts/kinds';
import { useFilters } from '../transactions/filters';

const signed = (cents: number, currency: Account['currency']) =>
  cents < 0 ? `−${formatMoney(-cents, currency)}` : formatMoney(cents, currency);

/**
 * Accounts as a stack of raised cards, like a wallet. Tapping the stack fans it out into a
 * grid; then each card opens Movimientos filtered by that account.
 */
export function AccountStack({
  accounts,
  balances,
}: {
  accounts: Account[];
  balances: Map<string, number>;
}) {
  const [open, setOpen] = useState(
    () => accounts.length <= 2 || matchMedia('(min-width: 1024px)').matches,
  );
  const navigate = useNavigate();
  const setFilters = useFilters((s) => s.set);
  const reset = useFilters((s) => s.reset);

  function show(id: string) {
    reset();
    setFilters({ accountId: id });
    navigate('/movimientos', { viewTransition: viewTransitions });
  }

  return (
    <section aria-labelledby="accounts-label">
      <div className="flex items-baseline justify-between px-1">
        <h2 id="accounts-label" className="text-[16px] font-semibold">
          Cuentas
        </h2>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="-mr-2 flex min-h-11 items-center gap-1 px-2 text-[13px] text-faint"
        >
          {open ? 'Apilar' : 'Desplegar'}
          <ChevronDown
            aria-hidden
            className={`size-4 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
          />
        </button>
      </div>
      <div
        className={open ? 'mt-2 grid grid-cols-2 gap-3' : 'mt-2 grid'}
        onClick={open ? undefined : () => setOpen(true)}
      >
        {accounts.map((a, i) => {
          const cents = balances.get(a.id) ?? 0;
          const Icon = accountKinds[a.kind].icon;
          return (
            <m.button
              key={a.id}
              layout
              transition={spring.snappy}
              type="button"
              tabIndex={open ? 0 : -1}
              aria-label={
                open ? `${a.name}: ${signed(cents, a.currency)}. Ver movimientos` : undefined
              }
              onClick={(e) => {
                if (!open) return;
                e.stopPropagation();
                show(a.id);
              }}
              // Later cards sit on top, so each one behind shows its name strip.
              style={{ zIndex: i }}
              className={`rel grid min-h-[84px] content-start gap-1.5 rounded-[20px] px-4 py-3.5 text-left ${
                open || i === 0 ? '' : '-mt-[46px]'
              }`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="truncate text-[13.5px] text-muted">{a.name}</span>
                {open || i === accounts.length - 1 ? (
                  <Icon aria-hidden className="size-4 shrink-0 text-faint" />
                ) : (
                  // Covered cards only show their top strip: the balance goes there.
                  <span
                    className={`tabular shrink-0 text-[13.5px] font-semibold ${cents < 0 ? 'text-negative' : ''}`}
                  >
                    {signed(cents, a.currency)}
                  </span>
                )}
              </span>
              <span
                className={`tabular truncate text-[19px] font-bold ${cents < 0 ? 'text-negative' : ''}`}
              >
                {signed(cents, a.currency)}
              </span>
              {a.kind === 'credit' && cents < 0 && (
                <span className="text-[12px] text-faint">Deuda de la tarjeta</span>
              )}
            </m.button>
          );
        })}
      </div>
    </section>
  );
}
