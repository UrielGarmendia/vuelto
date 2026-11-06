import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db } from '../../db/db';
import type { Category } from '../../db/types';
import { fromISODate, todayISO } from '../../lib/dates';
import { formatMoney, parseCents } from '../../lib/money';
import { BackLink } from '../../ui/BackLink';
import { CategoryIcon } from '../../ui/CategoryIcon';
import { Skeleton } from '../../ui/Skeleton';
import { toast } from '../../ui/toast';
import { listTransactions } from '../transactions/queries';
import { categoryTotals } from '../stats/stats';
import { budgetsFor, saveBudget } from './budgets';

const monthName = (month: string) =>
  new Intl.DateTimeFormat('es-AR', { month: 'long' }).format(fromISODate(`${month}-01`));

/** Bar colour: celeste while comfortable, amber from 80 %, red once over. */
const tone = (ratio: number) => (ratio > 1 ? 'bg-negative' : ratio >= 0.8 ? 'bg-over' : 'bg-hue');

export function BudgetsPage() {
  const month = todayISO().slice(0, 7);
  const categories = useLiveQuery(
    () =>
      db.categories
        .orderBy('order')
        .filter((c) => c.type === 'expense' && !c.deleted && !c.archived)
        .toArray(),
    [],
  );
  const budgets = useLiveQuery(() => db.budgets.toArray(), []);
  const txs = useLiveQuery(() => listTransactions(), []);
  const [editing, setEditing] = useState<string | null>(null);

  if (!categories || !budgets || !txs) {
    return (
      <div aria-hidden className="mx-auto max-w-[720px] pt-12">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="mt-6 h-28 rounded-[22px]" />
        <Skeleton className="mt-4 h-72 rounded-[22px]" />
      </div>
    );
  }

  const current = budgetsFor(budgets, month);
  const spent = new Map(categoryTotals(txs, month).map((c) => [c.categoryId, c.cents]));
  const totalBudget = [...current.values()].reduce((a, b) => a + b, 0);
  const totalSpent = [...current.keys()].reduce((a, id) => a + (spent.get(id) ?? 0), 0);
  // Budgeted categories first, then the rest in their usual order.
  const rows = [...categories].sort(
    (a, b) => Number(current.has(b.id)) - Number(current.has(a.id)),
  );

  return (
    <div className="mx-auto max-w-[720px] pt-1">
      <BackLink to="/ajustes" label="Ajustes" />
      <h1 className="mt-2 text-[22px] font-bold">Presupuestos</h1>
      <p className="mt-1 text-[14.5px] leading-snug text-muted">
        Para {monthName(month)}. Cada presupuesto sigue vigente los meses siguientes hasta que lo
        cambies, y alimenta el dial de Inicio.
      </p>

      {totalBudget > 0 && (
        <section aria-label="Total del mes" className="mt-4 rounded-[22px] bg-flat p-5">
          <p className="text-[13.5px] text-muted">Total presupuestado</p>
          <p className="mt-1 text-[15px]">
            <b className="tabular text-[20px] font-bold">{formatMoney(totalSpent)}</b>{' '}
            <span className="text-muted">de {formatMoney(totalBudget)}</span>
          </p>
          <Bar ratio={totalSpent / totalBudget} />
        </section>
      )}

      <ul className="mt-4 divide-y divide-line overflow-hidden rounded-[22px] bg-flat">
        {rows.map((c) => (
          <BudgetRow
            key={c.id}
            category={c}
            budget={current.get(c.id)}
            spent={spent.get(c.id) ?? 0}
            open={editing === c.id}
            onOpen={() => setEditing(editing === c.id ? null : c.id)}
            onSave={async (cents) => {
              await saveBudget(c.id, month, cents);
              setEditing(null);
              toast(
                cents
                  ? `Presupuesto de ${c.name} guardado`
                  : `Quitaste el presupuesto de ${c.name}`,
              );
            }}
          />
        ))}
      </ul>
    </div>
  );
}

function Bar({ ratio }: { ratio: number }) {
  return (
    <div className="well mt-3 h-2 overflow-hidden rounded-full" aria-hidden>
      <div
        className={`h-full rounded-full transition-[width] duration-500 ease-out ${tone(ratio)}`}
        style={{ width: `${Math.min(100, ratio * 100)}%` }}
      />
    </div>
  );
}

function BudgetRow({
  category: c,
  budget,
  spent,
  open,
  onOpen,
  onSave,
}: {
  category: Category;
  budget?: number;
  spent: number;
  open: boolean;
  onOpen: () => void;
  onSave: (cents: number) => Promise<void>;
}) {
  const [input, setInput] = useState(budget ? String(budget / 100).replace('.', ',') : '');
  const parsed = parseCents(input || '0');
  const ratio = budget ? spent / budget : 0;
  return (
    <li>
      <button
        type="button"
        aria-expanded={open}
        onClick={onOpen}
        className="hoverable flex min-h-[66px] w-full items-center gap-3 px-4 py-3 text-left"
      >
        <CategoryIcon icon={c.icon} color={c.color} />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className="truncate text-[15px] font-medium">{c.name}</span>
            <span className="tabular shrink-0 text-[13.5px] text-muted">
              {budget ? (
                <>
                  <span className={ratio > 1 ? 'text-negative' : 'text-ink'}>
                    {formatMoney(spent)}
                  </span>{' '}
                  de {formatMoney(budget)}
                </>
              ) : (
                'Sin presupuesto'
              )}
            </span>
          </span>
          {budget ? <Bar ratio={ratio} /> : null}
        </span>
      </button>
      {open && (
        <form
          className="flex gap-2 px-4 pb-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (parsed !== null && parsed >= 0) void onSave(parsed);
          }}
        >
          <label className="well flex min-h-12 flex-1 items-center gap-1.5 rounded-[14px] px-4 has-focus-visible:outline-2 has-focus-visible:outline-hue">
            <span className="text-muted">$</span>
            <input
              autoFocus
              inputMode="decimal"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              aria-label={`Presupuesto mensual de ${c.name}`}
              aria-invalid={parsed === null || parsed < 0}
              placeholder="0"
              className="tabular min-w-0 flex-1 bg-transparent text-[16px] outline-none"
            />
          </label>
          {budget ? (
            <button
              type="button"
              onClick={() => void onSave(0)}
              className="rel min-h-12 rounded-[14px] px-4 text-[14px] font-semibold text-negative"
            >
              Quitar
            </button>
          ) : null}
          <button
            type="submit"
            disabled={parsed === null || parsed <= 0}
            className="rel go min-h-12 rounded-[14px] px-5 text-[14px] font-bold"
          >
            Guardar
          </button>
        </form>
      )}
    </li>
  );
}
