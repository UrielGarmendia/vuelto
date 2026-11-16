import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { usePrefs } from '../../app/prefs';
import { db } from '../../db/db';
import { fromISODate, todayISO } from '../../lib/dates';
import { BackLink } from '../../ui/BackLink';
import { useRates } from '../currency/rates';
import { pct, signedMoney } from '../investments/format';
import { holdingsHistory, type HoldingsHistory } from '../iol/iol';
import { NetWorthChart } from './NetWorthChart';
import { netWorthSeries, periodChange, type Range } from './networth';

const RANGES: { id: Range; name: string }[] = [
  { id: '1M', name: 'el último mes' },
  { id: '3M', name: 'los últimos tres meses' },
  { id: '6M', name: 'los últimos seis meses' },
  { id: '1A', name: 'el último año' },
  { id: 'Todo', name: 'todo el período' },
];
const dayFmt = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'long' });

/** How net worth moved: a daily photo taken when the app opens, plus IOL's own history. */
export function NetWorthPage() {
  const days = useLiveQuery(() => db.netWorth.filter((d) => !d.deleted).toArray(), []);
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
  const rangeName = RANGES.find((r) => r.id === range)!.name;

  return (
    <div className="mx-auto max-w-[720px] pt-1">
      <BackLink to="/" />
      <h1 className="mt-2 text-[22px] font-bold">Patrimonio</h1>
      <p className="mt-1 text-[14.5px] text-muted">
        Disponible, invertido y deuda de tarjeta, día por día.
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
        {points.length === 0 ? (
          <p className="py-10 text-center text-[14.5px] text-muted">
            {currency === 'USD'
              ? 'No hay días con cotización del dólar en este período.'
              : 'Todavía no hay datos en este período.'}
          </p>
        ) : (
          <>
            <p className="text-[13px] text-muted">Variación en {rangeName}</p>
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
              <NetWorthChart points={points} currency={currency} />
            </div>
          </>
        )}
      </section>

      <div className="mt-4 grid gap-2 px-1 text-[13px] leading-relaxed text-faint">
        {history?.partial && <p>Completando la historia de IOL…</p>}
        {fromIol && firstOwn && (
          <p>
            Antes del {dayFmt.format(fromISODate(firstOwn))} la curva muestra solo lo que tenías en
            IOL, según su historial; los dólares de ese tramo se pasan a la cotización de hoy.
          </p>
        )}
        {!fromIol && firstOwn && firstOwn >= today && (
          <p>
            La curva arranca hoy. Vuelto guarda una foto de tu patrimonio cada día que abrís la app.
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
