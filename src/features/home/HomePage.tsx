import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronRight, CreditCard, Sparkles } from 'lucide-react';
import { m } from 'motion/react';
import { Link } from 'react-router';
import { db } from '../../db/db';
import { todayISO } from '../../lib/dates';
import { formatMoney } from '../../lib/money';
import { AnimatedNumber } from '../../ui/AnimatedNumber';
import { CategoryIcon } from '../../ui/CategoryIcon';
import { EmptyState } from '../../ui/EmptyState';
import { ease } from '../../ui/motion';
import { Skeleton } from '../../ui/Skeleton';
import { Sparkline } from '../../ui/Sparkline';
import { deleteTx, editTx } from '../transactions/actions';
import { listTransactions } from '../transactions/queries';
import { useTxSheet } from '../transactions/store';
import { TxRow } from '../transactions/TxRow';
import { useCatalog } from '../transactions/useCatalog';
import { accountBalances, dailySpending, monthTotals, topCategories, totals } from './summary';

const monthName = new Intl.DateTimeFormat('es-AR', { month: 'long' }).format(new Date());

export function HomePage() {
  const txs = useLiveQuery(() => listTransactions(), []);
  const accounts = useLiveQuery(() => db.accounts.toArray(), []);
  const catalog = useCatalog();
  const openNew = useTxSheet((s) => s.openNew);

  if (!txs || !accounts || !catalog.ready) return <HomeSkeleton />;

  const today = todayISO();
  const month = today.slice(0, 7);
  const { balanceCents, creditDebtCents } = totals(accounts, accountBalances(accounts, txs));
  const { expenseCents, incomeCents } = monthTotals(txs, month);
  const series = dailySpending(txs, today, 30);
  const spent30 = series.reduce((a, b) => a + b, 0);
  const top = topCategories(txs, month, 3);
  const recent = txs.slice(0, 5);

  return (
    <>
      <section aria-labelledby="balance-label" className="px-5 pt-8 pb-2">
        <h1 id="balance-label" className="text-sm font-medium text-muted">
          Tu saldo
        </h1>
        <AnimatedNumber
          cents={balanceCents}
          className="mt-1 block text-[52px] leading-none font-semibold tracking-tight"
        />
        {creditDebtCents > 0 && (
          <p className="mt-2 flex items-center gap-1.5 text-sm text-muted">
            <CreditCard aria-hidden className="size-4" />
            Incluye {formatMoney(creditDebtCents)} de deuda en tarjeta
          </p>
        )}
        <dl className="mt-6 grid grid-cols-2 gap-3">
          <div className="rounded-md bg-surface p-4 shadow-soft">
            <dt className="text-xs font-medium text-muted">Gastado en {monthName}</dt>
            <dd className="mt-1 text-xl font-semibold text-expense">
              <AnimatedNumber cents={expenseCents} />
            </dd>
          </div>
          <div className="rounded-md bg-surface p-4 shadow-soft">
            <dt className="text-xs font-medium text-muted">Ingresado en {monthName}</dt>
            <dd className="mt-1 text-xl font-semibold text-income">
              <AnimatedNumber cents={incomeCents} />
            </dd>
          </div>
        </dl>
      </section>

      {txs.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="Arrancá con tu primer gasto"
          action={
            <button
              type="button"
              onClick={openNew}
              className="min-h-11 rounded-full bg-ink px-5 text-sm font-semibold text-bg"
            >
              Cargar un gasto
            </button>
          }
        >
          Cargar un gasto lleva menos de 5 segundos.
        </EmptyState>
      ) : (
        <>
          <section aria-labelledby="trend-label" className="px-5 pt-4">
            <div className="rounded-md bg-surface p-4 shadow-soft">
              <div className="flex items-baseline justify-between">
                <h2 id="trend-label" className="text-xs font-medium text-muted">
                  Últimos 30 días
                </h2>
                <p className="tabular text-sm font-semibold">
                  {formatMoney(spent30)} <span className="font-normal text-muted">gastados</span>
                </p>
              </div>
              <Sparkline values={series} className="mt-3" />
            </div>
          </section>

          {top.length > 0 && (
            <section aria-labelledby="top-label" className="px-5 pt-6">
              <h2 id="top-label" className="mb-2 px-1 text-sm font-semibold">
                Lo que más gastaste en {monthName}
              </h2>
              <ul className="space-y-3 rounded-md bg-surface p-4 shadow-soft">
                {top.map(({ categoryId, cents }, i) => {
                  const cat = catalog.categories.get(categoryId);
                  const pct = expenseCents ? cents / expenseCents : 0;
                  return (
                    <li key={categoryId} className="flex items-center gap-3">
                      <CategoryIcon icon={cat?.icon} color={cat?.color} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-[15px] font-medium">{cat?.name}</span>
                          <span className="tabular text-[15px] font-semibold">
                            {formatMoney(cents)}
                          </span>
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
                          <m.div
                            className="h-full origin-left rounded-full"
                            style={{ backgroundColor: cat?.color }}
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: pct }}
                            transition={{ duration: 0.5, delay: 0.15 + i * 0.06, ease: ease.out }}
                          />
                        </div>
                      </div>
                      <span className="sr-only">{Math.round(pct * 100)}% del gasto del mes</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <section aria-labelledby="recent-label" className="pt-6">
            <div className="flex items-center justify-between px-6 pb-1">
              <h2 id="recent-label" className="text-sm font-semibold">
                Últimos movimientos
              </h2>
              <Link
                to="/movimientos"
                viewTransition
                className="-mr-2 flex min-h-11 items-center gap-0.5 px-2 text-sm font-medium text-accent-ink"
              >
                Ver todos <ChevronRight aria-hidden className="size-4" />
              </Link>
            </div>
            {recent.map((tx) => (
              <TxRow
                key={tx.id}
                tx={tx}
                category={tx.categoryId ? catalog.categories.get(tx.categoryId) : undefined}
                account={catalog.accounts.get(tx.accountId)}
                onDelete={deleteTx}
                onEdit={editTx}
              />
            ))}
          </section>
        </>
      )}
    </>
  );
}

function HomeSkeleton() {
  return (
    <div aria-hidden className="px-5 pt-8">
      <Skeleton className="h-3.5 w-20" />
      <Skeleton className="mt-3 h-12 w-48" />
      <div className="mt-6 grid grid-cols-2 gap-3">
        <Skeleton className="h-20 rounded-md" />
        <Skeleton className="h-20 rounded-md" />
      </div>
      <Skeleton className="mt-4 h-28 rounded-md" />
    </div>
  );
}
