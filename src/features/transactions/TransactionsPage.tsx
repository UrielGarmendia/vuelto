import { useLiveQuery } from 'dexie-react-hooks';
import { ReceiptText } from 'lucide-react';
import { EmptyState } from '../../ui/EmptyState';
import { PageHeader } from '../../ui/PageHeader';
import { Skeleton } from '../../ui/Skeleton';
import { listTransactions } from './queries';
import { useTxSheet } from './store';
import { TransactionList } from './TransactionList';
import { useCatalog } from './useCatalog';

export function TransactionsPage() {
  const transactions = useLiveQuery(() => listTransactions(), []);
  const catalog = useCatalog();
  const openNew = useTxSheet((s) => s.openNew);

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
              className="min-h-11 rounded-full bg-ink px-5 text-sm font-semibold text-bg"
            >
              Cargá tu primer gasto
            </button>
          }
        >
          Cada gasto e ingreso que cargues va a aparecer acá, agrupado por día.
        </EmptyState>
      ) : (
        <TransactionList
          transactions={transactions}
          categories={catalog.categories}
          accounts={catalog.accounts}
        />
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
