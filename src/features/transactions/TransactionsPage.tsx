import { useLiveQuery } from 'dexie-react-hooks';
import { ReceiptText, SearchX } from 'lucide-react';
import { useMemo } from 'react';
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
      <PageHeader title="Movimientos" />
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
              className="min-h-11 rounded-full bg-ink px-5 text-sm font-semibold text-ground"
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
                  className="min-h-11 rounded-full bg-flat-2 px-5 text-sm font-semibold"
                >
                  Limpiar filtros
                </button>
              }
            >
              No hay movimientos que coincidan con la búsqueda o los filtros.
            </EmptyState>
          ) : (
            <TransactionList
              transactions={filtered!}
              categories={catalog.categories}
              accounts={catalog.accounts}
            />
          )}
        </>
      )}
    </>
  );
}

function ListSkeleton() {
  return (
    <div aria-hidden className="px-5 pt-5">
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
