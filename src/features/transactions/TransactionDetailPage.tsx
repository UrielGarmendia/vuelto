import { useLiveQuery } from 'dexie-react-hooks';
import { Pencil, SearchX, Trash2 } from 'lucide-react';
import { useParams } from 'react-router';
import { db } from '../../db/db';
import type { Transaction } from '../../db/types';
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
  // `null` = loaded but missing, `undefined` = still loading.
  const tx = useLiveQuery(async () => (await db.transactions.get(id)) ?? null, [id]);

  const goBack = useGoBack('/movimientos');
  const back = <BackLink to="/movimientos" />;

  if (tx === undefined) return <div className="pt-1">{back}</div>;
  if (tx === null || tx.deleted) {
    return (
      <>
        <div className="pt-1">{back}</div>
        <EmptyState icon={SearchX} title="Este movimiento ya no existe">
          Puede que lo hayas borrado.
        </EmptyState>
      </>
    );
  }

  return (
    <article className="mx-auto max-w-[520px] pt-1">
      {back}
      <h1 className="sr-only">Detalle del movimiento</h1>
      <TxDetail tx={tx} onDeleted={() => void goBack()} />
    </article>
  );
}

/** The movement on a raised card; shared by the detail page and the wide-screen side panel. */
export function TxDetail({ tx, onDeleted }: { tx: Transaction; onDeleted?: () => void }) {
  const openEdit = useTxSheet((s) => s.openEdit);
  const { categories, accounts } = useCatalog();
  const category = tx.categoryId ? categories.get(tx.categoryId) : undefined;
  const account = accounts.get(tx.accountId);
  const sign = tx.type === 'income' ? '+' : '−';

  return (
    <div className="rel mt-3 rounded-[24px] p-[22px]">
      <div className="flex flex-col items-center pt-2 pb-5 text-center">
        <CategoryIcon icon={category?.icon} color={category?.color} />
        <h2 className="mt-3 text-[14px] text-muted">{category?.name ?? 'Sin categoría'}</h2>
        <p
          className={`wide mt-1.5 max-w-full truncate text-[clamp(30px,9vw,40px)] leading-tight font-extrabold ${
            tx.type === 'income' ? 'text-positive' : ''
          }`}
          style={{ viewTransitionName: `amount-${tx.id}` }}
        >
          {sign}
          {formatMoney(tx.amountCents, tx.currency)}
        </p>
      </div>

      <dl>
        {[
          ['Tipo', tx.type === 'income' ? 'Ingreso' : 'Gasto'],
          ['Fecha', formatDay(tx.date)],
          ['Cuenta', account?.name ?? '—'],
          ...(tx.note ? [['Nota', tx.note]] : []),
        ].map(([label, value]) => (
          <div
            key={label}
            className="flex min-h-12 items-center justify-between gap-4 border-t border-line py-3"
          >
            <dt className="text-[15px] text-muted">{label}</dt>
            <dd className="min-w-0 text-right text-[15px] font-medium break-words">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => openEdit(tx.id)}
          className="rel flex min-h-12 items-center justify-center gap-2 rounded-full text-[15px] font-semibold"
        >
          <Pencil aria-hidden className="size-4" /> Editar
        </button>
        <button
          type="button"
          onClick={async () => {
            await deleteWithUndo(tx.id);
            onDeleted?.();
          }}
          className="rel flex min-h-12 items-center justify-center gap-2 rounded-full text-[15px] font-semibold text-negative"
        >
          <Trash2 aria-hidden className="size-4" /> Eliminar
        </button>
      </div>
    </div>
  );
}
