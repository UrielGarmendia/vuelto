import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronRight, Sparkles } from 'lucide-react';
import { Fragment, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { viewTransitions } from '../../app/viewTransitions';
import { usePrefs, withAllWidgets, type HomeWidget } from '../../app/prefs';
import { GoalsWidget } from '../goals/GoalsWidget';
import { db } from '../../db/db';
import type { Budget, Category, Transaction } from '../../db/types';
import { fromISODate, todayISO } from '../../lib/dates';
import { formatMoney } from '../../lib/money';
import { Odometer } from '../../ui/Odometer';
import { Skeleton } from '../../ui/Skeleton';
import { closedWithin, monthBudget } from '../budgets/budgets';
import { toast } from '../../ui/toast';
import { useRates } from '../currency/rates';
import { snapshotTotal } from '../external/provider';
import { useIol } from '../iol/iol';
import { pickInsight, projectMonth, type Insight } from '../insights/insights';
import { deleteTx, editTx } from '../transactions/actions';
import { listTransactions } from '../transactions/queries';
import { useTxSheet } from '../transactions/store';
import { TxRow } from '../transactions/TxRow';
import { useCatalog } from '../transactions/useCatalog';
import { AccountStack } from './AccountStack';
import { dialBaseline, dialSummary, dialTicks, AVERAGE_MONTHS } from './dial';
import { MonthDial } from './MonthDial';
import {
  accountBalances,
  addMonths,
  monthDaily,
  monthTotals,
  pastMonths,
  pastPace,
  totals,
} from './summary';

const monthFmt = new Intl.DateTimeFormat('es-AR', { month: 'long' });
const weekdayFmt = new Intl.DateTimeFormat('es-AR', { weekday: 'long' });
const monthNameOf = (month: string) => monthFmt.format(fromISODate(`${month}-01`));
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
// "sábado" → "sábados"; "lunes" stays "lunes". 1 Nov 2026 is a Sunday, the base for weekdays.
const plural = (s: string) => (s.endsWith('s') ? s : `${s}s`);
const round100 = (cents: number) => Math.round(cents / 100) * 100;

export function HomePage() {
  const txs = useLiveQuery(() => listTransactions(), []);
  const accounts = useLiveQuery(
    () =>
      db.accounts
        .orderBy('order')
        .filter((a) => !a.deleted && !a.archived)
        .toArray(),
    [],
  );
  const budgets = useLiveQuery(() => db.budgets.toArray(), []);
  const catalog = useCatalog();
  const rates = useRates();
  const iol = useIol();
  const widgets = withAllWidgets(usePrefs((s) => s.homeWidgets));
  const rateKind = usePrefs((s) => s.rateKind);
  const [selected, setSelected] = useState<number | null>(null);
  useMonthCelebration(txs, budgets);

  if (!txs || !accounts || !budgets || !catalog.ready) return <HomeSkeleton />;

  const today = todayISO();
  const month = today.slice(0, 7);
  const day = Number(today.slice(8));
  const monthName = monthNameOf(month);
  const daily = monthDaily(txs, month);
  const n = daily.length;
  const left = n - day;
  const budget = monthBudget(budgets, month);
  const baseline = dialBaseline(budget, pastMonths(txs, month, AVERAGE_MONTHS), n);
  const { expenseCents, incomeCents } = monthTotals(txs, month);
  const pace = pastPace(txs, month, day);
  const summary = dialSummary(expenseCents, day, n, baseline, pace?.upToDay);
  // With history, the rest of the month is what usually comes after today; otherwise a line.
  const projected = pace
    ? expenseCents + Math.max(0, pace.total - pace.upToDay)
    : projectMonth(expenseCents, day, n);
  const balances = accountBalances(accounts, txs);
  const usdRate = rates?.values[rateKind];
  const { balanceCents, creditDebtCents } = totals(accounts, balances, usdRate);
  const available = balanceCents + creditDebtCents;
  // With IOL linked, the card shows net worth: cash, investments and card debt.
  const invested = iol?.account && iol.snapshot ? snapshotTotal(iol.snapshot, usdRate) : undefined;
  const bigCents = invested === undefined ? available : balanceCents + invested;
  if (iol?.account && invested !== undefined) balances.set(iol.account.id, invested);
  const running =
    (baseline.mode === 'budget' && projected > budget!) ||
    (summary.mode === 'average' && summary.percentVsAverage > 10);
  const dayTxs = selected
    ? txs.filter((t) => t.date === `${month}-${String(selected).padStart(2, '0')}`)
    : [];

  const blocks: Record<HomeWidget, React.ReactNode> = {
    dial: (
      <section
        aria-label="Cómo viene el mes"
        className="relative isolate overflow-hidden rounded-[24px] bg-flat px-5 pt-3 pb-5"
        style={
          {
            '--glow': `color-mix(in oklab, var(--color-${running ? 'over' : 'hue'}) 16%, transparent)`,
            '--glow-2': `color-mix(in oklab, var(--color-${running ? 'over' : 'hue'}) 9%, transparent)`,
          } as React.CSSProperties
        }
      >
        <div aria-hidden className="dial-glow -z-10" />
        <MonthDial
          ticks={dialTicks(daily, day, baseline)}
          daily={daily}
          today={day}
          monthName={monthName}
          baseline={baseline}
          summary={summary}
          selected={selected}
          onSelect={setSelected}
        />
        {selected === null ? (
          <>
            {baseline.mode === 'budget' && (
              <p className="-mt-1 text-center text-[15px]">
                Gastaste <b className="tabular">{formatMoney(expenseCents)}</b> de{' '}
                {formatMoney(budget!)}
              </p>
            )}
            {baseline.mode === 'average' && (
              <p className="-mt-1 text-center text-[15px]">
                Tu promedio es <b className="tabular">{formatMoney(round100(baseline.perDay!))}</b>{' '}
                por día
              </p>
            )}
            <p className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-center text-[13px] text-muted">
              {baseline.mode === 'none' ? (
                <span>Cargá unas semanas y vas a ver cómo viene cada día.</span>
              ) : (
                <>
                  <span>
                    <i className="mr-1.5 inline-block h-1 w-2.5 rounded-sm bg-hue align-[2px]" />
                    {baseline.mode === 'budget'
                      ? 'dentro del presupuesto diario'
                      : 'debajo de tu promedio'}
                  </span>
                  <span>
                    <i className="mr-1.5 inline-block h-1 w-2.5 rounded-sm bg-over align-[2px]" />
                    día que te pasaste
                  </span>
                </>
              )}
            </p>
            <p className="mt-2 text-center text-[12.5px] text-faint">
              Tocá un día del dial para ver qué pasó.
            </p>
          </>
        ) : (
          <DayList txs={dayTxs} catalog={catalog} onClose={() => setSelected(null)} />
        )}
      </section>
    ),
    balance: (
      <section
        aria-labelledby="available-label"
        className="rel rounded-[24px] p-[22px] [container-type:inline-size]"
      >
        <p id="available-label" className="text-[14px] text-muted">
          {invested === undefined ? 'Disponible' : 'Patrimonio'}
        </p>
        <Odometer
          cents={bigCents}
          className="wide mt-1.5 leading-[1.05] font-extrabold"
          // Long amounts shrink to fit the card instead of overflowing it.
          style={{ fontSize: fitSize(formatMoney(bigCents), 52) }}
        />
        {invested === undefined ? (
          <>
            {creditDebtCents > 0 && (
              <p className="mt-1 text-[13px] text-faint">
                Después de pagar la tarjeta te quedan{' '}
                <span className="tabular text-muted">{signedMoney(balanceCents)}</span>
              </p>
            )}
            <dl className="mt-4 grid grid-cols-3 gap-2.5">
              <Kpi label="Entró" cents={incomeCents} />
              <Kpi label="Salió" cents={expenseCents} />
              <Kpi label="Tarjeta" cents={creditDebtCents} />
            </dl>
          </>
        ) : (
          <>
            <p className="mt-1 text-[13px] text-faint">
              Lo que tenés más lo invertido, menos la tarjeta.
            </p>
            <dl className="mt-4 grid grid-cols-3 gap-2.5">
              <Kpi label="Disponible" cents={available} />
              <Kpi label="Invertido" cents={invested} />
              <Kpi label="Tarjeta" cents={creditDebtCents} />
            </dl>
            <p className="mt-3 border-t border-line pt-3 text-[13px] text-muted">
              Este mes entró <b className="tabular text-ink">{formatMoney(incomeCents)}</b> y salió{' '}
              <b className="tabular text-ink">{formatMoney(expenseCents)}</b>.
            </p>
          </>
        )}
      </section>
    ),
    insight:
      txs.length > 0 ? (
        <InsightLine insight={pickInsight(txs, today)} catalog={catalog} month={month} />
      ) : null,
    accounts: accounts.length > 0 ? <AccountStack accounts={accounts} balances={balances} /> : null,
    goals: <GoalsWidget />,
    recent:
      txs.length === 0 ? (
        <FirstSteps />
      ) : (
        <section aria-labelledby="recent-label" className="rounded-[24px] bg-flat px-1 pt-4 pb-1">
          <div className="flex items-center justify-between px-4 pb-1">
            <h2 id="recent-label" className="text-[16px] font-semibold">
              Últimos movimientos
            </h2>
            <Link
              to="/movimientos"
              viewTransition={viewTransitions}
              className="-mr-2 flex min-h-11 items-center gap-0.5 px-2 text-[13.5px] font-medium text-hue"
            >
              Ver todos <ChevronRight aria-hidden className="size-4" />
            </Link>
          </div>
          {txs.slice(0, 5).map((tx, i) => (
            <TxRow
              key={tx.id}
              tx={tx}
              category={tx.categoryId ? catalog.categories.get(tx.categoryId) : undefined}
              account={catalog.accounts.get(tx.accountId)}
              toAccount={tx.toAccountId ? catalog.accounts.get(tx.toAccountId) : undefined}
              onDelete={deleteTx}
              onEdit={editTx}
              first={i === 0}
              last={i === Math.min(4, txs.length - 1)}
            />
          ))}
        </section>
      ),
  };

  return (
    <>
      <header className="pt-2">
        <h1 className="text-[22px] font-bold">{capital(monthName)}</h1>
        <p className="mt-1 max-w-[52ch] text-[15px] leading-snug text-muted">
          {headline(baseline.mode, { budget, projected, left, today, baseline, n, pace })}
        </p>
      </header>

      <div className="mt-4 gap-4 md:columns-2 [&>*]:mb-4 [&>*]:break-inside-avoid">
        {widgets
          .filter((w) => w.visible)
          .map((w) => (
            <Fragment key={w.id}>{blocks[w.id]}</Fragment>
          ))}
      </div>
      <p className="pb-2 text-center">
        <Link
          to="/ajustes/inicio"
          viewTransition={viewTransitions}
          className="inline-flex min-h-11 items-center px-3 text-[13.5px] font-medium text-faint"
        >
          Personalizar Inicio
        </Link>
      </p>
    </>
  );
}

/** Font size that fits `text` in its container (needs container-type) without passing `max`. */
const fitSize = (text: string, max: number) =>
  `min(${max}px, ${(100 / (text.length * 0.66)).toFixed(2)}cqw)`;

const signedMoney = (cents: number) => (cents < 0 ? `−${formatMoney(-cents)}` : formatMoney(cents));

function headline(
  mode: 'budget' | 'average' | 'none',
  {
    budget,
    projected,
    left,
    today,
    baseline,
    n,
    pace,
  }: {
    budget?: number;
    projected: number;
    left: number;
    today: string;
    baseline: { perDay?: number };
    n: number;
    pace: { total: number } | null;
  },
) {
  const rest =
    left === 0 ? 'Hoy cierra el mes.' : left === 1 ? 'Falta 1 día.' : `Faltan ${left} días.`;
  if (mode === 'budget') {
    const diff = round100(projected - budget!);
    return diff > 0
      ? `A este ritmo te pasás ${formatMoney(diff)} del presupuesto. ${rest}`
      : `A este ritmo cerrás con ${formatMoney(-diff)} de margen. ${rest}`;
  }
  if (mode === 'average') {
    const avg = pace?.total ?? baseline.perDay! * n;
    const pct = Math.round((projected / avg - 1) * 100);
    return pct === 0
      ? `Vas en línea con tu promedio. ${rest}`
      : `A este ritmo cerrás ${Math.abs(pct)} % ${pct > 0 ? 'arriba' : 'abajo'} de tu promedio. ${rest}`;
  }
  return `${capital(weekdayFmt.format(fromISODate(today)))} ${Number(today.slice(8))}. ${rest}`;
}

function Kpi({ label, cents }: { label: string; cents: number }) {
  return (
    <div className="min-w-0">
      <dt className="text-[12.5px] text-muted">{label}</dt>
      <dd className="tabular mt-1 truncate text-[15px] font-semibold">{formatMoney(cents)}</dd>
    </div>
  );
}

type Catalog = ReturnType<typeof useCatalog>;

function InsightLine({
  insight,
  catalog,
  month,
}: {
  insight: Insight | null;
  catalog: Catalog;
  month: string;
}) {
  if (!insight) return null;
  const prev = monthNameOf(addMonths(month, -1));
  let body: React.ReactNode;
  if (insight.kind === 'weekday') {
    body = (
      <>
        Los <b>{plural(weekdayFmt.format(new Date(2026, 10, 1 + insight.weekday)))}</b> gastás{' '}
        <b className="tabular">{insight.ratio.toFixed(1).replace('.', ',')} veces</b> lo de un día
        promedio.
      </>
    );
  } else {
    const name = (catalog.categories.get(insight.categoryId) as Category | undefined)?.name;
    body = (
      <>
        {name} va{' '}
        <b className={`tabular ${insight.kind === 'up' ? 'text-over' : 'text-hue'}`}>
          {insight.pct > 0 ? '+' : '−'}
          {Math.abs(insight.pct)} %
        </b>{' '}
        contra {prev} a esta altura: {formatMoney(insight.nowCents)} frente a{' '}
        {formatMoney(insight.beforeCents)}.
      </>
    );
  }
  return (
    <p className="flex items-start gap-2.5 rounded-[20px] bg-flat px-[18px] py-4 text-[15px] leading-snug">
      <Sparkles
        aria-hidden
        className={`mt-0.5 size-[18px] shrink-0 ${insight.kind === 'up' ? 'text-over' : 'text-hue'}`}
      />
      <span>{body}</span>
    </p>
  );
}

function DayList({
  txs,
  catalog,
  onClose,
}: {
  txs: Transaction[];
  catalog: Catalog;
  onClose: () => void;
}) {
  return (
    <div className="-mx-4 mt-1">
      <div className="flex items-center justify-between px-4">
        <h2 className="text-[14px] font-semibold text-muted">
          {txs.length === 0
            ? 'Sin movimientos ese día'
            : txs.length === 1
              ? '1 movimiento'
              : `${txs.length} movimientos`}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="-mr-2 min-h-11 px-2 text-[13.5px] font-medium text-hue"
        >
          Ver el mes
        </button>
      </div>
      {txs.map((tx, i) => (
        <TxRow
          key={tx.id}
          tx={tx}
          category={tx.categoryId ? catalog.categories.get(tx.categoryId) : undefined}
          account={catalog.accounts.get(tx.accountId)}
          toAccount={tx.toAccountId ? catalog.accounts.get(tx.toAccountId) : undefined}
          onDelete={deleteTx}
          onEdit={editTx}
          first={i === 0}
          last={i === txs.length - 1}
        />
      ))}
    </div>
  );
}

function FirstSteps() {
  const openNew = useTxSheet((s) => s.openNew);
  return (
    <section className="grid justify-items-center rounded-[24px] bg-flat px-6 py-10 text-center md:col-start-1">
      <h2 className="text-[18px] font-semibold">Arrancá con tu primer gasto</h2>
      <p className="mt-2 max-w-[34ch] text-[15px] leading-relaxed text-muted">
        Cargar uno lleva menos de cinco segundos. El dial se va llenando día a día.
      </p>
      <button
        type="button"
        onClick={openNew}
        className="rel go mt-6 min-h-[52px] rounded-[18px] px-6 text-[15px] font-bold"
      >
        Cargar un gasto
      </button>
    </section>
  );
}

function HomeSkeleton() {
  return (
    <div aria-hidden className="pt-2">
      <Skeleton className="h-6 w-32" />
      <Skeleton className="mt-3 h-4 w-64" />
      <div className="mt-5 grid gap-4 md:grid-cols-[1.05fr_1fr]">
        <Skeleton className="h-[360px] rounded-[24px]" />
        <div className="grid content-start gap-4">
          <Skeleton className="h-[170px] rounded-[24px]" />
          <Skeleton className="h-[64px] rounded-[20px]" />
        </div>
      </div>
    </div>
  );
}

/** Once per month: a quiet note when the month that just ended stayed within its budget. */
function useMonthCelebration(txs?: Transaction[], budgets?: Budget[]) {
  useEffect(() => {
    if (!txs || !budgets) return;
    const prev = addMonths(todayISO().slice(0, 7), -1);
    const key = `vuelto-celebrated-${prev}`;
    try {
      if (localStorage.getItem(key)) return;
      if (!closedWithin(budgets, monthTotals(txs, prev).expenseCents, prev)) return;
      localStorage.setItem(key, '1');
    } catch {
      return;
    }
    toast(`Cerraste ${monthNameOf(prev)} dentro del presupuesto. Bien ahí.`);
  }, [txs, budgets]);
}
