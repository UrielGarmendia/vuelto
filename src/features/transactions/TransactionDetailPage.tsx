import { useLiveQuery } from 'dexie-react-hooks';
import { Pencil, SearchX, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useParams } from 'react-router';
import { db } from '../../db/db';
import type { Transaction } from '../../db/types';
import { formatDay } from '../../lib/dates';
import { arsCents, formatMoney } from '../../lib/money';
import { BackLink } from '../../ui/BackLink';
import { useGoBack } from '../../ui/useGoBack';
import { CategoryIcon } from '../../ui/CategoryIcon';
import { EmptyState } from '../../ui/EmptyState';
import { deleteGroupWithUndo, deleteWithUndo } from './actions';
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
  const [confirmGroup, setConfirmGroup] = useState(false);
  const category = tx.categoryId ? categories.get(tx.categoryId) : undefined;
  const account = accounts.get(tx.accountId);
  const to = tx.toAccountId ? accounts.get(tx.toAccountId) : undefined;
  const sign = tx.type === 'income' ? '+' : tx.type === 'expense' ? '−' : '';
  const isTransfer = tx.type === 'transfer';
  const rows: [string, string][] = [
    ['Tipo', isTransfer ? 'Transferencia' : tx.type === 'income' ? 'Ingreso' : 'Gasto'],
    ['Fecha', formatDay(tx.date)],
    ...((isTransfer
      ? [
          ['Desde', account?.name ?? '—'],
          ['Hacia', to?.name ?? '—'],
        ]
      : [['Cuenta', account?.name ?? '—']]) as [string, string][]),
    ...(tx.installment
      ? [['Cuota', `${tx.installment.number} de ${tx.installment.total}`] as [string, string]]
      : []),
    ...(tx.currency === 'USD' && tx.rateAtDate
      ? [
          [
            'En pesos',
            `${formatMoney(arsCents(tx))} (dólar a ${formatMoney(Math.round(tx.rateAtDate * 100))})`,
          ] as [string, string],
        ]
      : []),
    ...(tx.recurringId ? [['Repetición', 'Se carga sola cada período'] as [string, string]] : []),
    ...(tx.note ? [['Nota', tx.note] as [string, string]] : []),
  ];

  async function remove(all: boolean) {
    if (all && tx.installment) await deleteGroupWithUndo(tx.installment.groupId);
    else await deleteWithUndo(tx.id);
    onDeleted?.();
  }

  return (
    <div className="rel mt-3 rounded-[24px] p-[22px]">
      <div className="flex flex-col items-center pt-2 pb-5 text-center">
        {isTransfer ? (
          <CategoryIcon icon="arrow-left-right" color="#8d9096" />
        ) : (
          <CategoryIcon icon={category?.icon} color={category?.color} />
        )}
        <h2 className="mt-3 text-[14px] text-muted">
          {isTransfer ? 'Transferencia' : (category?.name ?? 'Sin categoría')}
        </h2>
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
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="flex min-h-12 items-center justify-between gap-4 border-t border-line py-3"
          >
            <dt className="text-[15px] text-muted">{label}</dt>
            <dd className="min-w-0 text-right text-[15px] font-medium break-words">{value}</dd>
          </div>
        ))}
      </dl>

      {confirmGroup ? (
        <div className="mt-4 grid gap-2.5" role="group" aria-label="Eliminar cuotas">
          <p className="text-center text-[14px] text-muted">
            ¿Eliminar solo esta cuota o la compra entera?
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => void remove(false)}
              className="rel min-h-12 rounded-full text-[15px] font-semibold text-negative"
            >
              Solo esta
            </button>
            <button
              type="button"
              onClick={() => void remove(true)}
              className="rel min-h-12 rounded-full text-[15px] font-semibold text-negative"
            >
              Todas las cuotas
            </button>
          </div>
          <button
            type="button"
            onClick={() => setConfirmGroup(false)}
            className="min-h-11 text-[14px] font-medium text-hue"
          >
            Cancelar
          </button>
        </div>
      ) : (
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
            onClick={() => (tx.installment ? setConfirmGroup(true) : void remove(false))}
            className="rel flex min-h-12 items-center justify-center gap-2 rounded-full text-[15px] font-semibold text-negative"
          >
            <Trash2 aria-hidden className="size-4" /> Eliminar
          </button>
        </div>
      )}
    </div>
  );
}
