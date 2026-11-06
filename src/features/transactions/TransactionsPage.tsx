import { useLiveQuery } from 'dexie-react-hooks';
import { ReceiptText, SearchX } from 'lucide-react';
import { useMemo, useState } from 'react';
import { arsCents, formatMoney } from '../../lib/money';
import { TxDetail } from './TransactionDetailPage';
import type { Transaction } from '../../db/types';
import { todayISO } from '../../lib/dates';
import { EmptyState } from '../../ui/EmptyState';
import { PageHeader } from '../../ui/PageHeader';
import { Skeleton } from '../../ui/Skeleton';
import { FilterBar } from './FilterBar';
import { filterTransactions, useFilters } from './filters';
import { listTransactions } from './queries';
import { useTxSheet } from './store';
import { TransactionList } from './TransactionList';
import { useCatalog } from './useCatalog';

export function TransactionsPage() {
  const transactions = useLiveQuery(() => listTransactions(), []);
  const catalog = useCatalog();
  const openNew = useTxSheet((s) => s.openNew);
  const filters = useFilters();
  const filtered = useMemo(
    () => transactions && filterTransactions(transactions, filters, catalog.categories, todayISO()),
    [transactions, filters, catalog.categories],
  );
  const [picked, setPicked] = useState<string>();
  // The side panel shows the picked movement while it is still in the list, else the newest.
  const current = filtered?.find((t) => t.id === picked) ?? filtered?.[0];
  const pickable = useMemo(
    () => ({
      categories: [...catalog.categories.values()]
        .filter((c) => !c.deleted && !c.archived)
        .sort((a, b) => a.order - b.order),
      accounts: [...catalog.accounts.values()]
        .filter((a) => !a.deleted && !a.archived)
        .sort((a, b) => a.order - b.order),
    }),
    [catalog],
  );

  return (
    <>
      <PageHeader title="Movimientos">
        {filtered && filtered.length > 0 && <Summary txs={filtered} />}
      </PageHeader>
      {!transactions || !catalog.ready ? (
        <ListSkeleton />
      ) : transactions.length === 0 ? (
        <EmptyState
          icon={ReceiptText}
          title="Todavía no hay movimientos"
          action={
            <button
              type="button"
              onClick={openNew}
              className="rel go min-h-[52px] rounded-[18px] px-6 text-[15px] font-bold"
            >
              Cargá tu primer gasto
            </button>
          }
        >
          Cada gasto e ingreso que cargues va a aparecer acá, agrupado por día.
        </EmptyState>
      ) : (
        <>
          <FilterBar categories={pickable.categories} accounts={pickable.accounts} />
          {filtered!.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title="Nada por acá"
              action={
                <button
                  type="button"
                  onClick={filters.reset}
                  className="rel min-h-11 rounded-full px-5 text-[14px] font-semibold"
                >
                  Limpiar filtros
                </button>
              }
            >
              No hay movimientos que coincidan con la búsqueda o los filtros.
            </EmptyState>
          ) : (
            <div className="grid items-start gap-6 lg:grid-cols-[1fr_380px]">
              <section aria-label="Lista de movimientos" className="min-w-0">
                <TransactionList
                  transactions={filtered!}
                  categories={catalog.categories}
                  accounts={catalog.accounts}
                  currentId={current?.id}
                  onOpen={setPicked}
                />
              </section>
              {current && (
                <aside aria-label="Detalle" className="sticky top-6 hidden lg:block">
                  <TxDetail key={current.id} tx={current} />
                </aside>
              )}
            </div>
          )}
        </>
      )}
    </>
  );
}

function ListSkeleton() {
  return (
    <div aria-hidden className="pt-5">
      <Skeleton className="mb-3 h-3.5 w-24" />
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex items-center gap-3 py-3">
          <Skeleton className="size-11 rounded-[14px]" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-3.5 w-16" />
        </div>
      ))}
    </div>
  );
}

function Summary({ txs }: { txs: Transaction[] }) {
  let income = 0;
  let expense = 0;
  for (const t of txs) {
    if (t.type === 'income') income += arsCents(t);
    else if (t.type === 'expense') expense += arsCents(t);
  }
  return (
    <p className="mt-1 text-[15px] leading-snug text-muted">
      {txs.length === 1 ? '1 movimiento' : `${txs.length} movimientos`}: entraron{' '}
      <span className="tabular text-ink">{formatMoney(income)}</span> y salieron{' '}
      <span className="tabular text-ink">{formatMoney(expense)}</span>.
    </p>
  );
}
