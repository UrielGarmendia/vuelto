import { LineChart, RefreshCw, WifiOff } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Link } from 'react-router';
import { usePrefs } from '../../app/prefs';
import { viewTransitions } from '../../app/viewTransitions';
import { formatMoney } from '../../lib/money';
import { BackLink } from '../../ui/BackLink';
import { DonutRing } from '../../ui/Donut';
import { EmptyState } from '../../ui/EmptyState';
import { holeFontSize } from '../../ui/fit';
import { useOnline } from '../../ui/useOnline';
import { usePullToRefresh } from '../../ui/usePullToRefresh';
import { useRates } from '../currency/rates';
import {
  cashTotal,
  dayChange,
  dayChangeCents,
  dayChangeTotal,
  investedTotal,
  snapshotTotal,
  type AssetCategory,
  type Position,
} from '../external/provider';
import { CATEGORY_COLORS, MARKET_COLORS, MARKET_NAMES } from '../iol/colors';
import { useIol, useIolStatus } from '../iol/iol';
import { assetCategory } from '../iol/normalize';
import { assetPath, pct, since, signedMoney } from './format';

type Sort = 'value' | 'change';

/** Everything held at IOL: totals, how it splits, and every position. */
export function InvestmentsPage() {
  const iol = useIol();
  const { status, message, refresh } = useIolStatus();
  const rateKind = usePrefs((s) => s.rateKind);
  const rate = useRates()?.values[rateKind];
  const online = useOnline();
  const [sort, setSort] = useState<Sort>('value');
  usePullToRefresh(useCallback(() => void refresh(), [refresh]));

  if (!iol) return null;
  const s = iol.snapshot;
  if (!iol.account || !s) {
    return (
      <div className="mx-auto max-w-[720px] pt-1">
        <BackLink to="/" />
        <EmptyState
          icon={LineChart}
          title={iol.account ? 'Todavía no hay datos de IOL' : 'IOL no está conectado'}
          action={
            <Link
              to="/ajustes/cuentas"
              viewTransition={viewTransitions}
              className="rel go inline-flex min-h-12 items-center rounded-[16px] px-6 font-bold"
            >
              {iol.account ? 'Ir a Cuentas' : 'Conectar IOL'}
            </Link>
          }
        >
          {iol.account
            ? 'Actualizá la cuenta para traer tu portafolio.'
            : 'Conectá tu cuenta de InvertirOnline en Cuentas para ver tu portafolio acá.'}
        </EmptyState>
      </div>
    );
  }

  const ars = (p: Position) =>
    p.currency === 'ARS' ? p.valueCents : rate ? Math.round(p.valueCents * rate) : 0;
  const total = snapshotTotal(s, rate);
  const change = dayChange(s, rate);
  const changeCents = dayChangeTotal(s, rate);
  const invested = investedTotal(s, rate);

  const groups = new Map<AssetCategory, Position[]>();
  for (const p of s.positions) {
    const t = assetCategory(p.type);
    groups.set(t, [...(groups.get(t) ?? []), p]);
  }
  const byValue = (a: Position, b: Position) => ars(b) - ars(a);
  const byChange = (a: Position, b: Position) => (b.dayChangePct ?? 0) - (a.dayChangePct ?? 0);
  const sorted = [...groups]
    .map(([t, list]) => ({
      type: t,
      cents: list.reduce((a, p) => a + ars(p), 0),
      list: [...list].sort(sort === 'value' ? byValue : byChange),
    }))
    .sort((a, b) => b.cents - a.cents);

  const byMarket = new Map<'ARG' | 'USA', number>();
  for (const p of s.positions) {
    const c = p.country ?? 'ARG';
    byMarket.set(c, (byMarket.get(c) ?? 0) + ars(p));
  }

  return (
    <div className="mx-auto max-w-[720px] pt-1 lg:max-w-[960px]">
      <BackLink to="/" />
      <div className="mt-2 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold">Inversiones</h1>
          <p className="mt-0.5 text-[13px] text-faint" aria-live="polite">
            IOL · {status === 'loading' ? 'Actualizando…' : `Actualizado ${since(s.fetchedAt)}`}
          </p>
        </div>
        <button
          type="button"
          aria-label="Actualizar inversiones"
          disabled={status === 'loading' || !online}
          onClick={() => void refresh()}
          className="rel grid size-11 shrink-0 place-items-center rounded-full text-muted disabled:opacity-50"
        >
          <RefreshCw
            aria-hidden
            className={`size-[18px] ${status === 'loading' ? 'animate-spin motion-reduce:animate-none' : ''}`}
          />
        </button>
      </div>

      {!online && (
        <p
          role="status"
          className="mt-4 flex items-center gap-2 rounded-[14px] border border-line bg-flat-2 px-4 py-3 text-[13.5px] text-muted"
        >
          <WifiOff aria-hidden className="size-4 shrink-0" />
          Sin conexión: mostramos lo último que trajimos.
        </p>
      )}
      {online && status === 'error' && (
        <p
          role="alert"
          className="mt-4 rounded-[14px] border border-line bg-flat-2 px-4 py-3 text-[13.5px] text-muted"
        >
          {message}
        </p>
      )}

      <section
        aria-label="Total en IOL"
        className="rel mt-4 rounded-[24px] p-5 [container-type:inline-size]"
      >
        <p className="text-[14px] text-muted">Total</p>
        <p className="wide mt-1 text-[clamp(28px,9cqw,44px)] leading-tight font-extrabold">
          {formatMoney(total)}
        </p>
        <p className="tabular mt-0.5 text-[14px] text-muted">
          {rate ? `≈ ${formatMoney(Math.round(total / rate), 'USD')}` : 'Sin cotización del dólar'}
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-3 @[30rem]:grid-cols-3">
          <Figure label="Efectivo" value={formatMoney(cashTotal(s, rate))} />
          <Figure label="Invertido" value={formatMoney(invested)} />
          <div className="col-span-2 @[30rem]:col-span-1">
            <dt className="text-[12.5px] text-muted">Hoy</dt>
            <dd className={`tabular mt-0.5 text-[15px] font-semibold ${tone(change)}`}>
              {change === undefined ? '—' : `${signedMoney(changeCents)} · ${pct(change)}`}
            </dd>
          </div>
        </dl>
      </section>

      {invested > 0 && (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Split
            title="Por tipo"
            parts={sorted.map((g) => ({ id: g.type, cents: g.cents }))}
            color={(id) => CATEGORY_COLORS[id as AssetCategory]}
            name={(id) => id}
          />
          <Split
            title="Por mercado"
            parts={[...byMarket]
              .filter(([, c]) => c > 0)
              .map(([id, cents]) => ({ id, cents }))
              .sort((a, b) => b.cents - a.cents)}
            color={(id) => MARKET_COLORS[id as 'ARG' | 'USA']}
            name={(id) => MARKET_NAMES[id as 'ARG' | 'USA']}
          />
        </div>
      )}

      <section aria-labelledby="positions-title" className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="positions-title" className="text-[17px] font-semibold">
            Posiciones <span className="text-faint">({s.positions.length})</span>
          </h2>
          <div role="radiogroup" aria-label="Ordenar" className="well flex rounded-full p-1">
            {(
              [
                ['value', 'Valor'],
                ['change', 'Variación'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={sort === id}
                onClick={() => setSort(id)}
                className={`min-h-9 rounded-full px-4 text-[13.5px] font-semibold ${
                  sort === id ? 'rel' : 'text-muted'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {s.positions.length === 0 ? (
          <p className="mt-3 text-[14px] text-muted">No tenés posiciones abiertas.</p>
        ) : (
          sorted.map((g) => (
            <div key={g.type} className="mt-4">
              <h3 className="flex items-center gap-2 px-1 text-[13px] font-semibold text-muted">
                <span
                  aria-hidden
                  className="size-2.5 rounded-[3px]"
                  style={{ background: CATEGORY_COLORS[g.type] }}
                />
                <span className="flex-1">{g.type}</span>
                <span className="tabular">{formatMoney(g.cents)}</span>
              </h3>
              <ul className="mt-1.5 overflow-hidden rounded-[20px] bg-flat">
                {g.list.map((p) => (
                  <PositionRow key={`${p.market}:${p.symbol}`} p={p} />
                ))}
              </ul>
            </div>
          ))
        )}
        <p className="mt-4 px-1 text-[12.5px] leading-relaxed text-faint">
          IOL no informa el precio promedio de compra ni el resultado de cada posición, así que no
          los mostramos.
        </p>
      </section>
    </div>
  );
}

const tone = (v: number | undefined) =>
  v === undefined || v === 0 ? '' : v > 0 ? 'text-hue' : 'text-over';

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[12.5px] text-muted">{label}</dt>
      <dd className="tabular mt-0.5 truncate text-[15px] font-semibold">{value}</dd>
    </div>
  );
}

function PositionRow({ p }: { p: Position }) {
  const moved = dayChangeCents(p);
  return (
    <li className="border-b border-line last:border-b-0">
      <Link
        to={assetPath(p)}
        viewTransition={viewTransitions}
        className="hoverable flex min-h-[64px] items-center gap-3 px-4 py-3"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold">{p.symbol}</span>
          <span className="block truncate text-[12.5px] text-muted">{p.description}</span>
          <span className="tabular block truncate text-[12.5px] text-faint">
            {p.quantity.toLocaleString('es-AR')} ×{' '}
            {p.price === undefined ? '—' : formatMoney(Math.round(p.price * 100), p.currency)}
          </span>
        </span>
        <span className="tabular shrink-0 text-right">
          <span className="block text-[15px] font-semibold">
            {formatMoney(p.valueCents, p.currency)}
          </span>
          <span className={`block text-[12.5px] ${tone(p.dayChangePct)}`}>
            {p.dayChangePct === undefined
              ? 'sin variación'
              : `${signedMoney(moved, p.currency)} · ${pct(p.dayChangePct)}`}
          </span>
        </span>
      </Link>
    </li>
  );
}

function Split({
  title,
  parts,
  color,
  name,
}: {
  title: string;
  parts: { id: string; cents: number }[];
  color: (id: string) => string;
  name: (id: string) => string;
}) {
  const [sel, setSel] = useState<string | null>(null);
  const total = parts.reduce((a, p) => a + p.cents, 0);
  if (!total) return null;
  const focus = parts.find((p) => p.id === sel);
  const shown = formatMoney(focus ? focus.cents : total);
  return (
    <section aria-label={title} className="flex flex-col rounded-[24px] bg-flat p-5">
      <h2 className="text-[16px] font-semibold">{title}</h2>
      <DonutRing
        parts={parts}
        total={total}
        sel={sel}
        onSelect={setSel}
        color={color}
        label={`${title}: ${parts.map((p) => `${name(p.id)} ${Math.round((p.cents / total) * 100)} %`).join(', ')}`}
        className="max-w-[260px]"
      >
        <p className="pointer-events-none truncate px-[30%] text-[13px] text-muted">
          {focus ? name(focus.id) : 'Invertido'}
        </p>
        <p
          className="wide pointer-events-none mt-0.5 font-extrabold"
          style={{ fontSize: holeFontSize(shown, 18) }}
        >
          {shown}
        </p>
        {focus && (
          <p className="pointer-events-none mt-0.5 text-[13px] text-muted">
            {Math.round((focus.cents / total) * 100)} %
          </p>
        )}
      </DonutRing>
      <ul className="mt-2 grid gap-1">
        {parts.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              aria-pressed={sel === p.id}
              onClick={() => setSel(sel === p.id ? null : p.id)}
              className={`flex min-h-10 w-full items-center gap-2 rounded-[12px] px-2 text-left text-[13.5px] ${
                sel === p.id ? 'bg-flat-2' : ''
              }`}
            >
              <span
                aria-hidden
                className="size-2.5 shrink-0 rounded-[3px]"
                style={{ background: color(p.id) }}
              />
              <span className="flex-1 truncate">{name(p.id)}</span>
              <span className="tabular text-muted">{Math.round((p.cents / total) * 100)} %</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
