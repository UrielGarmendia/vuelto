import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { usePrefs } from '../../app/prefs';
import { db } from '../../db/db';
import { fromISODate, todayISO, toISODate } from '../../lib/dates';
import { formatMoney } from '../../lib/money';
import { BackLink } from '../../ui/BackLink';
import { useRates } from '../currency/rates';
import { pct, signedMoney } from '../investments/format';
import { holdingsHistory, type HoldingsHistory } from '../iol/iol';
import { NetWorthChart } from './NetWorthChart';
import { netWorthSeries, periodChange, RANGE_DAYS, type Range } from './networth';

const RANGES: { id: Range; name: string }[] = [
  { id: '1M', name: 'el último mes' },
  { id: '3M', name: 'los últimos tres meses' },
  { id: '6M', name: 'los últimos seis meses' },
  { id: '1A', name: 'el último año' },
  { id: 'Todo', name: 'todo el período' },
];
const dayFmt = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'long' });
const shortDay = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short' });
const addDays = (iso: string, n: number) =>
  toISODate(new Date(fromISODate(iso).getTime() + n * 86_400_000));

/** How net worth moved: a daily photo taken when the app opens, plus IOL's own history. */
export function NetWorthPage() {
  const days = useLiveQuery(() => db.netWorth.filter((d) => !d.deleted).toArray(), []);
  // Card debt only matters with an active card.
  const hasCards = useLiveQuery(
    () => db.accounts.filter((a) => a.kind === 'credit' && !a.archived && !a.deleted).count(),
    [],
  );
  const rateKind = usePrefs((s) => s.rateKind);
  const rate = useRates()?.values[rateKind];
  const [range, setRange] = useState<Range>('3M');
  const [currency, setCurrency] = useState<'ARS' | 'USD'>('ARS');
  const [history, setHistory] = useState<HoldingsHistory | undefined>();

  useEffect(() => {
    let live = true;
    void holdingsHistory().then((h) => live && setHistory(h));
    return () => {
      live = false;
    };
  }, []);

  if (!days) return null;
  const today = todayISO();
  const points = netWorthSeries({ days, history, range, currency, today, rate });
  const change = periodChange(points);
  const firstOwn = [...days].sort((a, b) => a.date.localeCompare(b.date))[0]?.date;
  const fromIol = points.some((p) => !p.own);
  const rangeStart =
    range === 'Todo' ? '' : addDays(today, -RANGE_DAYS[range as keyof typeof RANGE_DAYS]);
  // A curve that starts later than the range says from when it counts.
  const since =
    points[0] && points[0].date > rangeStart
      ? `desde el ${shortDay.format(fromISODate(points[0].date))}`
      : `en ${RANGES.find((r) => r.id === range)!.name}`;
  const tooFew = points.filter((p) => p.own).length < 2 && !fromIol;

  return (
    <div className="mx-auto max-w-[720px] pt-1">
      <BackLink to="/" />
      <h1 className="mt-2 text-[22px] font-bold">Patrimonio</h1>
      <p className="mt-1 text-[14.5px] text-muted">
        {hasCards ? 'Disponible, invertido y deuda de tarjeta' : 'Disponible e invertido'}, día por
        día.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Segmented
          label="Período"
          value={range}
          onChange={setRange}
          options={RANGES.map((r) => ({ id: r.id, label: r.id, name: r.name }))}
        />
        <Segmented
          label="Moneda"
          value={currency}
          onChange={setCurrency}
          options={[
            { id: 'ARS', label: '$', name: 'Pesos' },
            { id: 'USD', label: 'US$', name: 'Dólares' },
          ]}
        />
      </div>

      <section aria-label="Curva del patrimonio" className="rel mt-4 rounded-[24px] p-5">
        {tooFew && firstOwn ? (
          <div className="py-6 text-center">
            <p className="text-[17px] font-semibold">
              Tu historia arranca el {dayFmt.format(fromISODate(firstOwn))}
            </p>
            <p className="mx-auto mt-2 max-w-[36ch] text-[14px] leading-relaxed text-muted">
              Vuelto guarda una foto de tu patrimonio cada día que abrís la app. Con dos días ya vas
              a ver cómo se mueve.
            </p>
            {points[0] && (
              <p className="wide mt-4 text-[26px] font-extrabold">
                {formatMoney(points[points.length - 1]!.total, currency)}
              </p>
            )}
          </div>
        ) : points.length === 0 ? (
          <p className="py-10 text-center text-[14.5px] text-muted">
            {currency === 'USD'
              ? 'No hay días con cotización del dólar en este período.'
              : 'Todavía no hay datos en este período.'}
          </p>
        ) : (
          <>
            <p className="text-[13px] text-muted">
              Variación {since}
              {change?.iolOnly ? ' (solo IOL)' : ''}
            </p>
            <p
              className={`wide mt-1 text-[24px] leading-tight font-extrabold ${
                !change || change.cents === 0 ? '' : change.cents > 0 ? 'text-hue' : 'text-over'
              }`}
            >
              {change ? signedMoney(change.cents, currency) : '—'}
            </p>
            <p className="tabular text-[13.5px] text-muted">
              {change
                ? change.pct === undefined
                  ? 'sin porcentaje (arrancó en cero)'
                  : pct(change.pct)
                : 'Hace falta más de un día para comparar.'}
            </p>
            <div className="mt-4">
              <NetWorthChart points={points} currency={currency} showDebt={!!hasCards} />
            </div>
          </>
        )}
      </section>

      <div className="mt-4 grid gap-2 px-1 text-[13px] leading-relaxed text-faint">
        {history?.partial && <p>Completando la historia de IOL…</p>}
        {fromIol && firstOwn && (
          <p>
            Antes del {dayFmt.format(fromISODate(firstOwn))} la curva muestra solo lo que tenías en
            IOL (efectivo e inversiones), según su historial.
          </p>
        )}
      </div>
    </div>
  );
}

function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { id: T; label: string; name: string }[];
}) {
  return (
    <div role="radiogroup" aria-label={label} className="well flex rounded-full p-1">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          aria-label={o.name}
          onClick={() => onChange(o.id)}
          className={`min-h-9 min-w-11 rounded-full px-3 text-[13.5px] font-semibold ${
            value === o.id ? 'rel' : 'text-muted'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
