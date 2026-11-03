import { Sparkles } from 'lucide-react';
import { formatMoney } from '../../lib/money';
import { EmptyState } from '../../ui/EmptyState';

const monthName = new Intl.DateTimeFormat('es-AR', { month: 'long' }).format(new Date());

export function HomePage() {
  return (
    <>
      <section aria-labelledby="balance-label" className="px-5 pt-8 pb-6">
        <p id="balance-label" className="text-sm font-medium text-muted">
          Tu saldo
        </p>
        <p className="tabular mt-1 text-[52px] leading-none font-semibold tracking-tight">
          {formatMoney(0)}
        </p>
        <dl className="mt-6 grid grid-cols-2 gap-3">
          <div className="rounded-md bg-surface p-4 shadow-soft">
            <dt className="text-xs font-medium text-muted">Gastado en {monthName}</dt>
            <dd className="tabular mt-1 text-xl font-semibold text-expense">{formatMoney(0)}</dd>
          </div>
          <div className="rounded-md bg-surface p-4 shadow-soft">
            <dt className="text-xs font-medium text-muted">Ingresado en {monthName}</dt>
            <dd className="tabular mt-1 text-xl font-semibold text-income">{formatMoney(0)}</dd>
          </div>
        </dl>
      </section>
      <EmptyState icon={Sparkles} title="Arrancá con tu primer gasto">
        Tocá el botón + de abajo. Cargar un gasto lleva menos de 5 segundos.
      </EmptyState>
    </>
  );
}
