import { useLiveQuery } from 'dexie-react-hooks';
import { ChartPie, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { viewTransitions } from '../../app/viewTransitions';
import { fromISODate, todayISO } from '../../lib/dates';
import { formatMoney } from '../../lib/money';
import { EmptyState } from '../../ui/EmptyState';
import { PageHeader } from '../../ui/PageHeader';
import { Skeleton } from '../../ui/Skeleton';
import { addMonths, daysInMonth, monthDaily, pastPace } from '../home/summary';
import { CalendarHeat } from './CalendarHeat';
import { projectMonth } from '../insights/insights';
import { useFilters } from '../transactions/filters';
import { listTransactions } from '../transactions/queries';
import { useCatalog } from '../transactions/useCatalog';
import { categoryTotals, monthSeries, weekdaySpending } from './stats';
import './stats.css';

const monthLong = new Intl.DateTimeFormat('es-AR', { month: 'long' });
const monthShort = new Intl.DateTimeFormat('es-AR', { month: 'short' });
const monthYear = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' });
const nameOf = (month: string, f = monthLong) =>
  f.format(fromISODate(`${month}-01`)).replace('.', '');
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const round100 = (c: number) => Math.round(c / 100) * 100;
const pctText = (p: number) => `${p > 0 ? '+' : p < 0 ? '−' : ''}${Math.abs(p)} %`;
const OTHERS = 'otros';

export function StatsPage() {
  const txs = useLiveQuery(() => listTransactions(), []);
  const catalog = useCatalog();
  const today = todayISO();
  const current = today.slice(0, 7);
  const [month, setMonth] = useState(current);
  const [sel, setSel] = useState<string | null>(null);

  if (!txs || !catalog.ready) return <StatsSkeleton />;

  const isCurrent = month === current;
  const days = daysInMonth(month);
  const elapsed = isCurrent ? Number(today.slice(8)) : days;
  const totals = categoryTotals(txs, month);
  const spent = totals.reduce((a, c) => a + c.cents, 0);
  const prev = addMonths(month, -1);
  const prevAll = categoryTotals(txs, prev);
  const prevSpent = prevAll.reduce((a, c) => a + c.cents, 0);
  // While the month is running, categories compare with last month up to the same day.
  const prevTotals = new Map(
    (isCurrent ? categoryTotals(txs, prev, elapsed) : prevAll).map((c) => [c.categoryId, c.cents]),
  );
  const pace = isCurrent ? pastPace(txs, month, elapsed) : null;
  const projected = isCurrent
    ? pace
      ? spent + Math.max(0, pace.total - pace.upToDay)
      : projectMonth(spent, elapsed, days)
    : spent;
  const vsPrev = prevSpent ? Math.round((projected / prevSpent - 1) * 100) : null;
  const series = monthSeries(txs, month, 12);
  const hasHistory = series.some((s) => s.cents > 0);
  const select = (m: string) => {
    setMonth(m);
    setSel(null);
  };

  const pick = (
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-label="Mes anterior"
        onClick={() => select(prev)}
        className="rel grid size-10 place-items-center rounded-full"
      >
        <ChevronLeft aria-hidden className="size-5" />
      </button>
      <p className="min-w-[9.5rem] text-center text-[15px] font-semibold" aria-live="polite">
        {capital(nameOf(month, monthYear))}
      </p>
      <button
        type="button"
        aria-label="Mes siguiente"
        disabled={isCurrent}
        onClick={() => select(addMonths(month, 1))}
        className="rel grid size-10 place-items-center rounded-full disabled:opacity-35"
      >
        <ChevronRight aria-hidden className="size-5" />
      </button>
    </div>
  );

  if (!hasHistory) {
    return (
      <>
        <PageHeader title="Estadísticas" />
        <EmptyState icon={ChartPie} title="Faltan datos para mostrar">
          Con unos días de movimientos vas a ver en qué se te va la plata.
        </EmptyState>
      </>
    );
  }

  // Top six categories, the rest grouped so the donut stays readable.
  const top = totals.slice(0, 6);
  const rest = spent - top.reduce((a, c) => a + c.cents, 0);
  const parts = [
    ...top.map((c) => ({ id: c.categoryId, cents: c.cents })),
    ...(rest > 0 ? [{ id: OTHERS, cents: rest }] : []),
  ];
  const color = (id: string) =>
    id === OTHERS ? 'var(--color-idle)' : (catalog.categories.get(id)?.color ?? '#8d9096');
  const name = (id: string) =>
    id === OTHERS ? 'Otros' : (catalog.categories.get(id)?.name ?? 'Sin categoría');

  return (
    <>
      <PageHeader title="Estadísticas">
        <p className="mt-1 max-w-[56ch] text-[15px] leading-snug text-muted">
          {vsPrev === null
            ? `En ${nameOf(month)} gastaste ${formatMoney(spent)}.`
            : isCurrent
              ? `${capital(nameOf(month))} viene ${vsPrev > 0 ? 'más caro' : 'más barato'} que ${nameOf(prev)}: proyectás `
              : `${capital(nameOf(month))} salió ${vsPrev > 0 ? 'más caro' : 'más barato'} que ${nameOf(prev)}: `}
          {vsPrev !== null && (
            <>
              <b className="tabular font-semibold text-ink">{formatMoney(round100(projected))}</b>{' '}
              contra {formatMoney(prevSpent)}.
            </>
          )}
        </p>
      </PageHeader>

      <div className="mb-4 flex justify-start">{pick}</div>

      <div className="grid items-start gap-4 lg:grid-cols-2 lg:items-stretch">
        <dl className="grid gap-2.5 sm:grid-cols-3 lg:col-span-2">
          <Kpi
            label={`Contra ${nameOf(prev, monthShort)}`}
            value={vsPrev === null ? '—' : pctText(vsPrev)}
            tone={vsPrev === null ? undefined : vsPrev > 0 ? 'over' : 'hue'}
            note={isCurrent ? 'proyección del mes' : 'mes cerrado'}
          />
          <Kpi
            label="Por día"
            value={formatMoney(round100(spent / elapsed))}
            note={`promedio de ${nameOf(month)}`}
          />
          <Kpi
            label={isCurrent ? 'Fin de mes' : 'Total'}
            value={formatMoney(round100(projected))}
            note={isCurrent ? 'a este ritmo' : `gastado en ${nameOf(month)}`}
          />
        </dl>

        {spent > 0 ? (
          <>
            <Donut
              parts={parts}
              total={spent}
              sel={sel}
              setSel={setSel}
              color={color}
              name={name}
              caption={isCurrent ? `al ${elapsed} de ${nameOf(month, monthShort)}` : nameOf(month)}
            />
            <div className="grid gap-4">
              <MonthBars
                series={series}
                current={month}
                projected={isCurrent ? projected : undefined}
                onPick={select}
              />
              <Legend
                parts={parts}
                prev={prevTotals}
                prevName={isCurrent ? `${nameOf(prev)} a esta altura` : nameOf(prev)}
                sel={sel}
                setSel={setSel}
                color={color}
                name={name}
              />
            </div>
            <CalendarHeat month={month} daily={monthDaily(txs, month)} lastDay={elapsed} />
            <WeekdayBars values={weekdaySpending(txs, month, elapsed)} />
          </>
        ) : (
          <div className="rounded-[24px] bg-flat px-6 py-10 text-center text-[15px] text-muted lg:col-span-2">
            No hay gastos en {nameOf(month)}.
          </div>
        )}
      </div>
    </>
  );
}

function Kpi({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note: string;
  tone?: 'over' | 'hue';
}) {
  return (
    // A row on phones (label and note left, figure right), a tile from 640 px.
    <div className="grid min-w-0 grid-cols-[1fr_auto] items-center gap-x-3 rounded-[20px] bg-flat px-4 py-3 sm:block sm:p-4">
      <dt className="truncate text-[12.5px] text-muted">{label}</dt>
      <dd
        className={`tabular row-span-2 truncate text-[18px] font-bold sm:mt-1.5 ${
          tone === 'over' ? 'text-over' : tone === 'hue' ? 'text-hue' : ''
        }`}
      >
        {value}
      </dd>
      <dd className="truncate text-[12px] text-faint sm:mt-0.5">{note}</dd>
    </div>
  );
}

interface Part {
  id: string;
  cents: number;
}
interface Paint {
  sel: string | null;
  setSel: (id: string | null) => void;
  color: (id: string) => string;
  name: (id: string) => string;
}

/** Ring segments for the donut, clockwise from twelve o'clock. */
function donutArcs(parts: Part[], total: number) {
  const R = 110;
  const r = 72;
  let angle = -Math.PI / 2;
  return parts.map((p) => {
    const sweep = (p.cents / total) * Math.PI * 2;
    const gap = parts.length > 1 ? 0.012 : 0;
    const a0 = angle + gap;
    // A single category is a full ring: stop just short so the arc stays drawable.
    const a1 = angle + Math.min(sweep, Math.PI * 2 - 0.0001) - gap;
    angle += sweep;
    const pt = (rad: number, a: number) =>
      `${(150 + rad * Math.cos(a)).toFixed(2)} ${(150 + rad * Math.sin(a)).toFixed(2)}`;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    return {
      ...p,
      mid: (a0 + a1) / 2,
      d: `M ${pt(R, a0)} A ${R} ${R} 0 ${large} 1 ${pt(R, a1)} L ${pt(r, a1)} A ${r} ${r} 0 ${large} 0 ${pt(r, a0)} Z`,
    };
  });
}

function Donut({
  parts,
  total,
  sel,
  setSel,
  color,
  name,
  caption,
}: Paint & { parts: Part[]; total: number; caption: string }) {
  const navigate = useNavigate();
  const arcs = donutArcs(parts, total);
  const focus = arcs.find((a) => a.id === sel);
  const filter = useFilters((s) => s.set);
  const reset = useFilters((s) => s.reset);

  return (
    <section aria-labelledby="donut-label" className="flex flex-col rounded-[24px] bg-flat p-5">
      <div className="flex items-baseline justify-between">
        <h2 id="donut-label" className="text-[16px] font-semibold">
          En qué se fue la plata
        </h2>
        <span className="text-[13px] text-faint">{caption}</span>
      </div>
      <div className="donut relative grid flex-1 content-center justify-items-center py-2 [container-type:inline-size]">
        <svg
          viewBox="0 0 300 300"
          className="w-full max-w-[380px] overflow-visible"
          role="img"
          aria-label="Gasto por categoría"
        >
          {arcs.map((a, i) => (
            <path
              key={a.id}
              d={a.d}
              fill={color(a.id)}
              opacity={sel && sel !== a.id ? 0.3 : 1}
              style={{
                animationDelay: `${i * 60}ms`,
                transform:
                  sel === a.id
                    ? `translate(${Math.cos(a.mid) * 10}px, ${Math.sin(a.mid) * 10}px)`
                    : undefined,
              }}
              onClick={() => setSel(sel === a.id ? null : a.id)}
            />
          ))}
        </svg>
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center">
          <p className="pointer-events-none truncate px-[30%] text-[13px] text-muted">
            {focus ? name(focus.id) : 'Total'}
          </p>
          <p
            className="wide pointer-events-none mt-0.5 font-extrabold"
            // Fits inside the hole of the ring, which is about 45 % of the chart's width.
            style={{
              fontSize: `min(20px, ${(42 / (formatMoney(focus ? focus.cents : total).length * 0.66)).toFixed(2)}cqw)`,
            }}
          >
            {formatMoney(focus ? focus.cents : total)}
          </p>
          {focus && focus.id !== OTHERS ? (
            <button
              type="button"
              onClick={() => {
                reset();
                filter({ categoryId: focus.id });
                navigate('/movimientos', { viewTransition: viewTransitions });
              }}
              className="mt-1 min-h-9 px-2 text-[13px] font-medium text-hue"
            >
              {Math.round((focus.cents / total) * 100)} % · Ver movimientos
            </button>
          ) : (
            <p className="pointer-events-none mt-1 text-[13px] text-muted">
              {focus ? `${Math.round((focus.cents / total) * 100)} % del mes` : 'tocá una porción'}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function Legend({
  parts,
  prev,
  prevName,
  sel,
  setSel,
  color,
  name,
}: Paint & { parts: Part[]; prev: Map<string, number>; prevName: string }) {
  const prevOthers =
    [...prev.values()].reduce((a, b) => a + b, 0) -
    parts.filter((p) => p.id !== OTHERS).reduce((a, p) => a + (prev.get(p.id) ?? 0), 0);
  return (
    <section aria-labelledby="legend-label" className="rounded-[24px] bg-flat p-5">
      <div className="flex items-baseline justify-between">
        <h2 id="legend-label" className="text-[16px] font-semibold">
          Por categoría
        </h2>
        <span className="text-[13px] text-faint">contra {prevName}</span>
      </div>
      <div className="mt-2 grid gap-0.5">
        {parts.map((p) => {
          const before = p.id === OTHERS ? prevOthers : prev.get(p.id);
          const diff = before ? Math.round(((p.cents - before) / before) * 100) : null;
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={sel === p.id}
              onClick={() => setSel(sel === p.id ? null : p.id)}
              className="hoverable flex min-h-11 items-center gap-2.5 rounded-[12px] px-2.5 text-left text-[14px] aria-pressed:bg-flat-2"
            >
              <span
                aria-hidden
                className="size-2.5 shrink-0 rounded-[3px]"
                style={{ background: color(p.id) }}
              />
              <span className="min-w-0 flex-1 truncate">{name(p.id)}</span>
              <span className="tabular">{formatMoney(p.cents)}</span>
              <span
                className={`tabular w-14 text-right text-[13px] ${
                  diff !== null && diff > 0 ? 'text-over' : 'text-faint'
                }`}
              >
                {diff === null ? '—' : pctText(diff)}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function MonthBars({
  series,
  current,
  projected,
  onPick,
}: {
  series: { month: string; cents: number }[];
  current: string;
  projected?: number;
  onPick: (month: string) => void;
}) {
  const W = 360;
  const H = 170;
  const last = series.at(-1)!;
  const max = Math.max(projected ?? 0, ...series.map((b) => b.cents), 1) * 1.08;
  const bw = (W - 8) / series.length;
  const y = (c: number) => H - 22 - (c / max) * (H - 34);
  const before = series.slice(-4, -1).filter((s) => s.cents > 0);
  const avg = before.length ? before.reduce((a, s) => a + s.cents, 0) / before.length : null;
  return (
    <section aria-labelledby="months-label" className="rounded-[24px] bg-flat p-5">
      <h2 id="months-label" className="text-[16px] font-semibold">
        Últimos 12 meses
      </h2>
      {avg !== null && (
        <p className="mt-0.5 text-[13px] text-faint">
          La línea punteada es el promedio de los 3 meses anteriores:{' '}
          <span className="tabular">{formatMoney(round100(avg))}</span>
        </p>
      )}
      <svg
        className="bars mt-3 block h-auto w-full"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Gasto por mes. ${nameOf(last.month)}: ${formatMoney(last.cents)}`}
      >
        {series.map((b, i) => {
          const on = b.month === current;
          return (
            <g key={b.month} onClick={() => onPick(b.month)} className="cursor-pointer">
              <title>{`${capital(nameOf(b.month))}: ${formatMoney(b.cents)}`}</title>
              <rect x={i * bw} y={0} width={bw} height={H} fill="transparent" />
              {on && projected !== undefined && projected > b.cents && (
                <rect
                  x={i * bw + bw * 0.18}
                  y={y(projected)}
                  width={bw * 0.64}
                  height={y(b.cents) - y(projected)}
                  fill="none"
                  stroke="var(--color-hue)"
                  strokeDasharray="3 3"
                  rx="3"
                />
              )}
              <rect
                className="bar"
                x={i * bw + bw * 0.18}
                y={y(b.cents)}
                width={bw * 0.64}
                height={Math.max(0, H - 22 - y(b.cents))}
                fill={on ? 'var(--color-hue)' : 'var(--color-idle)'}
                rx="3"
                style={{ animationDelay: `${i * 40}ms` }}
              />
              <text x={i * bw + bw / 2} y={H - 6} textAnchor="middle">
                {nameOf(b.month, monthShort)}
              </text>
            </g>
          );
        })}
        {avg !== null && (
          <line
            x1="0"
            x2={W}
            y1={y(avg)}
            y2={y(avg)}
            stroke="var(--color-faint)"
            strokeDasharray="2 4"
          />
        )}
      </svg>
    </section>
  );
}

const weekdays = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

function WeekdayBars({ values }: { values: number[] }) {
  // Monday first, as a week reads in Argentina.
  const order = [1, 2, 3, 4, 5, 6, 0];
  const max = Math.max(...values, 1);
  const peak = values.indexOf(Math.max(...values));
  return (
    <section aria-labelledby="weekday-label" className="rounded-[24px] bg-flat p-5">
      <div className="flex items-baseline justify-between">
        <h2 id="weekday-label" className="text-[16px] font-semibold">
          Por día de la semana
        </h2>
        <span className="text-[13px] text-faint">promedio por día</span>
      </div>
      <ul className="mt-4 grid grid-cols-7 items-end gap-2">
        {order.map((d) => (
          <li key={d} className="grid justify-items-center gap-1.5">
            <span className="tabular text-[10.5px] whitespace-nowrap text-faint">
              {values[d] ? `${Math.round(values[d]! / 100_000)} mil` : '—'}
            </span>
            <span className="flex h-24 w-full max-w-10 items-end">
              <span
                className={`w-full rounded-[6px] ${d === peak && values[d] ? 'bg-hue' : 'bg-idle'}`}
                style={{ height: `${Math.max(4, (values[d]! / max) * 100)}%` }}
              />
            </span>
            <span className="text-[12px] text-muted">{weekdays[d]}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function StatsSkeleton() {
  return (
    <div aria-hidden className="pt-2">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="mt-3 h-4 w-72" />
      <div className="mt-6 grid grid-cols-3 gap-2.5">
        <Skeleton className="h-24 rounded-[20px]" />
        <Skeleton className="h-24 rounded-[20px]" />
        <Skeleton className="h-24 rounded-[20px]" />
      </div>
      <Skeleton className="mt-4 h-80 rounded-[24px]" />
    </div>
  );
}
