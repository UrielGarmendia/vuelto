import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { usePrefs, useMoneyVisibility } from '../../app/prefs';
import { formatMoney } from '../../lib/money';
import { BackLink } from '../../ui/BackLink';
import { Skeleton } from '../../ui/Skeleton';
import { useRates } from '../currency/rates';
import { dayChangeCents, investedTotal, type Position } from '../external/provider';
import { CATEGORY_COLORS } from '../iol/colors';
import { CHART_MARKETS, priceHistory, useIol, type PriceRange } from '../iol/iol';
import { assetCategory, type PricePoint } from '../iol/normalize';
import { pct, signedMoney } from './format';

const RANGES: PriceRange[] = ['1S', '1M', '3M', '1A'];
const rangeNames: Record<PriceRange, string> = {
  '1S': 'una semana',
  '1M': 'un mes',
  '3M': 'tres meses',
  '1A': 'un año',
};

type Chart =
  | { state: 'loading' }
  | { state: 'none' }
  | { state: 'error' }
  | { state: 'ready'; points: PricePoint[] };

/** One asset: its price over time, what you hold and how much of the portfolio it is. */
export function AssetPage() {
  useMoneyVisibility();
  const { market = '', symbol = '' } = useParams();
  const iol = useIol();
  const rateKind = usePrefs((s) => s.rateKind);
  const rate = useRates()?.values[rateKind];
  const [range, setRange] = useState<PriceRange>('1M');
  const [chart, setChart] = useState<Chart>({ state: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const s = iol?.snapshot;
  const p = s?.positions.find((x) => x.symbol === symbol && (x.market || 'otro') === market);
  const category = p ? assetCategory(p.type) : undefined;
  // Funds and cauciones have no daily bars at IOL, whatever market they list.
  const charted =
    category !== undefined &&
    category !== 'FCI' &&
    category !== 'Cauciones' &&
    CHART_MARKETS.includes(market);

  useEffect(() => {
    if (!charted) return;
    let live = true;
    priceHistory(symbol, market, range).then(
      (points) => {
        if (live) setChart(points?.length ? { state: 'ready', points } : { state: 'none' });
      },
      (err: unknown) => {
        console.error(err);
        if (live) setChart({ state: 'error' });
      },
    );
    return () => {
      live = false;
    };
  }, [charted, symbol, market, range, attempt]);

  if (!iol) return null;
  if (!s || !p || !category) {
    return (
      <div className="mx-auto max-w-[720px] pt-1">
        <BackLink to="/inversiones" />
        <h1 className="mt-2 text-[22px] font-bold">{symbol}</h1>
        <p className="mt-2 text-[15px] text-muted">
          Este activo ya no está en tu portafolio de IOL.
        </p>
      </div>
    );
  }

  const ars = (x: Position) =>
    x.currency === 'ARS' ? x.valueCents : rate ? Math.round(x.valueCents * rate) : 0;
  const invested = investedTotal(s, rate);
  const weight = invested ? (ars(p) / invested) * 100 : undefined;
  const shown: Chart = charted ? chart : { state: 'none' };

  return (
    <div className="mx-auto max-w-[720px] pt-1">
      <BackLink to="/inversiones" />
      <header className="mt-2">
        <p className="flex items-center gap-2 text-[13px] text-muted">
          <span
            aria-hidden
            className="size-2.5 rounded-[3px]"
            style={{ background: CATEGORY_COLORS[category] }}
          />
          {category} · {p.market || 'Sin mercado'}
        </p>
        <h1 className="mt-1 text-[24px] font-bold">{p.symbol}</h1>
        <p className="text-[14.5px] text-muted">{p.description}</p>
      </header>

      <section aria-label="Precio" className="rel mt-4 rounded-[24px] p-5">
        <p className="text-[13px] text-muted">Precio actual</p>
        <p className="wide mt-1 text-[clamp(26px,8vw,36px)] leading-tight font-extrabold">
          {p.price === undefined ? '—' : formatMoney(Math.round(p.price * 100), p.currency)}
        </p>
        {p.dayChangePct === undefined ? (
          <p className="mt-0.5 text-[14px] text-muted">Sin variación informada</p>
        ) : (
          <dl
            className={`tabular mt-1 grid gap-0.5 text-[14px] ${
              p.dayChangePct > 0 ? 'text-hue' : p.dayChangePct < 0 ? 'text-over' : 'text-muted'
            }`}
          >
            <div className="flex flex-wrap gap-x-1.5">
              <dt className="text-muted">Precio hoy</dt>
              <dd>
                {p.price !== undefined &&
                  `${signedMoney(Math.round(unitChange(p.price, p.dayChangePct) * 100), p.currency)} · `}
                {pct(p.dayChangePct)}
              </dd>
            </div>
            <div className="flex flex-wrap gap-x-1.5">
              <dt className="text-muted">Tu posición hoy</dt>
              <dd>{signedMoney(dayChangeCents(p), p.currency)}</dd>
            </div>
          </dl>
        )}

        {charted && (
          <div role="radiogroup" aria-label="Rango" className="well mt-4 flex rounded-full p-1">
            {RANGES.map((r) => (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={range === r}
                aria-label={rangeNames[r]}
                onClick={() => {
                  setChart({ state: 'loading' });
                  setRange(r);
                }}
                className={`min-h-9 flex-1 rounded-full text-[13.5px] font-semibold ${
                  range === r ? 'rel' : 'text-muted'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        )}
        <div className="mt-4">
          {shown.state === 'loading' && <Skeleton className="h-[180px] w-full rounded-[16px]" />}
          {shown.state === 'none' && (
            <p className="grid h-[120px] place-items-center rounded-[16px] bg-flat-2 px-4 text-center text-[14px] text-muted">
              Sin gráfico disponible para este activo
            </p>
          )}
          {shown.state === 'error' && (
            <div className="grid h-[120px] place-items-center gap-2 rounded-[16px] bg-flat-2 px-4 text-center">
              <p className="text-[14px] text-muted">No se pudo traer el gráfico.</p>
              <button
                type="button"
                onClick={() => {
                  setChart({ state: 'loading' });
                  setAttempt((n) => n + 1);
                }}
                className="rel min-h-10 rounded-full px-4 text-[13.5px] font-semibold text-hue"
              >
                Reintentar
              </button>
            </div>
          )}
          {shown.state === 'ready' && (
            <PriceChart
              points={shown.points}
              currency={p.currency}
              label={`Precio de ${p.symbol} en ${rangeNames[range]}`}
            />
          )}
        </div>
      </section>

      <dl className="mt-4 grid grid-cols-2 gap-3 rounded-[24px] bg-flat p-5 sm:grid-cols-3">
        <div>
          <dt className="text-[12.5px] text-muted">Tu cantidad</dt>
          <dd className="tabular mt-0.5 text-[15px] font-semibold">
            {p.quantity.toLocaleString('es-AR')}
          </dd>
        </div>
        <div>
          <dt className="text-[12.5px] text-muted">Tu valor</dt>
          <dd className="tabular mt-0.5 text-[15px] font-semibold">
            {formatMoney(p.valueCents, p.currency)}
          </dd>
        </div>
        <div>
          <dt className="text-[12.5px] text-muted">Peso en el portafolio</dt>
          <dd className="tabular mt-0.5 text-[15px] font-semibold">
            {weight === undefined ? '—' : `${weight.toFixed(1).replace('.', ',')} %`}
          </dd>
        </div>
      </dl>
    </div>
  );
}

const day = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short' });

/** What one unit's price moved today, from today's price and its change in percent. */
const unitChange = (price: number, changePct: number) =>
  changePct <= -100 ? 0 : price - price / (1 + changePct / 100);

/** Closing prices as an area, with the first and last values and the change between them. */
function PriceChart({
  points,
  currency,
  label,
}: {
  points: PricePoint[];
  currency: Position['currency'];
  label: string;
}) {
  const W = 320;
  const H = 150;
  const closes = points.map((p) => p.close);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const span = max - min || 1;
  const x = (i: number) => (points.length > 1 ? (i / (points.length - 1)) * W : W / 2);
  const y = (v: number) => 8 + (1 - (v - min) / span) * (H - 16);
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.close).toFixed(1)}`);
  const first = points[0]!;
  const last = points[points.length - 1]!;
  const change = ((last.close - first.close) / first.close) * 100;
  const money = (v: number) => formatMoney(Math.round(v * 100), currency);
  const up = change >= 0;

  return (
    <figure>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className={`h-[180px] w-full ${up ? 'text-hue' : 'text-over'}`}
        role="img"
        aria-label={`${label}: de ${money(first.close)} a ${money(last.close)}, ${pct(change)}`}
      >
        <defs>
          <linearGradient id="price-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="currentColor" stopOpacity="0.28" />
            <stop offset="1" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${line.join(' ')} L${W} ${H} L0 ${H} Z`} fill="url(#price-fill)" />
        <path
          d={line.join(' ')}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
        />
      </svg>
      <figcaption className="tabular mt-2 flex justify-between gap-3 text-[12.5px] text-muted">
        <span>
          {day.format(first.t)} · {money(first.close)}
        </span>
        <span className={up ? 'text-hue' : 'text-over'}>{pct(change)}</span>
        <span>
          {day.format(last.t)} · {money(last.close)}
        </span>
      </figcaption>
    </figure>
  );
}
