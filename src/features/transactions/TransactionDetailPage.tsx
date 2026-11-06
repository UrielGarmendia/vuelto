import { useLiveQuery } from 'dexie-react-hooks';
import { Pencil, SearchX, Trash2 } from 'lucide-react';
import { useParams } from 'react-router';
import { db } from '../../db/db';
import { formatDay } from '../../lib/dates';
import { formatMoney } from '../../lib/money';
import { BackLink } from '../../ui/BackLink';
import { useGoBack } from '../../ui/useGoBack';
import { CategoryIcon } from '../../ui/CategoryIcon';
import { EmptyState } from '../../ui/EmptyState';
import { deleteWithUndo } from './actions';
import { useTxSheet } from './store';
import { useCatalog } from './useCatalog';

export function TransactionDetailPage() {
  const { id = '' } = useParams();
  const openEdit = useTxSheet((s) => s.openEdit);
  const { categories, accounts } = useCatalog();
  // `null` = loaded but missing, `undefined` = still loading.
  const tx = useLiveQuery(async () => (await db.transactions.get(id)) ?? null, [id]);

  const goBack = useGoBack('/movimientos');
  const back = <BackLink to="/movimientos" />;

  if (tx === undefined) return <div className="px-5 pt-3">{back}</div>;
  if (tx === null || tx.deleted) {
    return (
      <>
        <div className="px-5 pt-3">{back}</div>
        <EmptyState icon={SearchX} title="Este movimiento ya no existe">
          Puede que lo hayas borrado.
        </EmptyState>
      </>
    );
  }

  const category = tx.categoryId ? categories.get(tx.categoryId) : undefined;
  const account = accounts.get(tx.accountId);
  const sign = tx.type === 'income' ? '+' : '−';

  return (
    <article className="px-5 pt-3">
      {back}
      <div className="flex flex-col items-center pt-8 pb-8 text-center">
        <CategoryIcon icon={category?.icon} color={category?.color} />
        <h1 className="mt-3 text-[15px] font-medium text-muted">
          {category?.name ?? 'Sin categoría'}
        </h1>
        <p
          className={`tabular mt-1 text-[44px] leading-tight font-semibold tracking-tight ${
            tx.type === 'income' ? 'text-positive' : 'text-negative'
          }`}
          style={{ viewTransitionName: `amount-${tx.id}` }}
        >
          {sign}
          {formatMoney(tx.amountCents, tx.currency)}
        </p>
      </div>

      <dl className="divide-y divide-line rounded-md bg-flat">
        {[
          ['Tipo', tx.type === 'income' ? 'Ingreso' : 'Gasto'],
          ['Fecha', formatDay(tx.date)],
          ['Cuenta', account?.name ?? '—'],
          ...(tx.note ? [['Nota', tx.note]] : []),
        ].map(([label, value]) => (
          <div key={label} className="flex min-h-13 items-center justify-between gap-4 px-4 py-3">
            <dt className="text-[15px] text-muted">{label}</dt>
            <dd className="text-right text-[15px] font-medium break-words">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => openEdit(tx.id)}
          className="flex min-h-12 items-center justify-center gap-2 rounded-md bg-flat font-semibold"
        >
          <Pencil aria-hidden className="size-4" /> Editar
        </button>
        <button
          type="button"
          onClick={async () => {
            await deleteWithUndo(tx.id);
            void goBack();
          }}
          className="flex min-h-12 items-center justify-center gap-2 rounded-md bg-flat font-semibold text-negative"
        >
          <Trash2 aria-hidden className="size-4" /> Eliminar
        </button>
      </div>
    </article>
  );
}
