import { useState, type PointerEvent } from 'react';
import { fromISODate } from '../../lib/dates';
import { formatMoney, type Currency } from '../../lib/money';
import type { Point } from './networth';

const LAYER_COLORS = {
  available: 'var(--color-hue)',
  invested: 'var(--color-positive)',
  debt: '#B48EE0',
};

const dayFmt = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short' });
const yearFmt = new Intl.DateTimeFormat('es-AR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/**
 * Stacked areas over time: available at the bottom, invested on top, card debt (only with
 * cards) below zero. The scale fits the values, not zero, so a change is visible. Dragging
 * a finger (or the pointer) over it reads out that day.
 */
export function NetWorthChart({
  points,
  currency,
  showDebt,
  height = 220,
}: {
  points: readonly Point[];
  currency: Currency;
  showDebt: boolean;
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 360;
  const H = height;
  const stackTop = (p: Point) => Math.max(0, p.available) + p.invested;
  const lowest = (p: Point) =>
    showDebt && p.debt > 0 ? Math.min(0, p.available) - p.debt : stackTop(p);
  const hi = Math.max(...points.map(stackTop));
  const lo = Math.min(...points.map(lowest));
  // A margin around the values; never below zero when everything is above it.
  const pad = (hi - lo) * 0.15 || Math.abs(hi) * 0.05 || 100;
  const top = hi + pad;
  const bottom = lo >= 0 ? Math.max(0, lo - pad) : lo - pad;
  const span = top - bottom || 1;
  const t0 = fromISODate(points[0]!.date).getTime();
  const t1 = fromISODate(points[points.length - 1]!.date).getTime();
  const x = (p: Point) =>
    t1 === t0 ? W / 2 : ((fromISODate(p.date).getTime() - t0) / (t1 - t0)) * W;
  const y = (v: number) => 6 + (1 - (v - bottom) / span) * (H - 12);
  const area = (lo: (p: Point) => number, hi: (p: Point) => number) => {
    const upper = points.map((p, i) => `${i ? 'L' : 'M'}${x(p).toFixed(1)} ${y(hi(p)).toFixed(1)}`);
    const lower = [...points].reverse().map((p) => `L${x(p).toFixed(1)} ${y(lo(p)).toFixed(1)}`);
    return `${upper.join(' ')} ${lower.join(' ')} Z`;
  };
  const avail = (p: Point) => Math.max(0, p.available);
  const money = (c: number) => formatMoney(c, currency);
  const shown = hover === null ? points[points.length - 1]! : points[hover]!;
  const long = t1 - t0 > 300 * 86_400_000;

  const pick = (e: PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    let best = 0;
    points.forEach((p, i) => {
      if (Math.abs(x(p) - px) < Math.abs(x(points[best]!) - px)) best = i;
    });
    setHover(best);
  };

  return (
    <figure>
      <figcaption
        className="tabular flex flex-wrap items-baseline justify-between gap-x-3 text-[12.5px] text-muted"
        aria-live="polite"
      >
        <span>{(long ? yearFmt : dayFmt).format(fromISODate(shown.date))}</span>
        <span>
          <b className="text-ink">{money(shown.total)}</b>
          {!shown.own && ' · solo IOL'}
        </span>
      </figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="mt-2 w-full touch-pan-y"
        style={{ height: H }}
        role="img"
        aria-label={`Patrimonio del ${dayFmt.format(fromISODate(points[0]!.date))} al ${dayFmt.format(
          fromISODate(points[points.length - 1]!.date),
        )}: de ${money(points[0]!.total)} a ${money(points[points.length - 1]!.total)}`}
        onPointerMove={pick}
        onPointerDown={pick}
        onPointerLeave={() => setHover(null)}
      >
        {bottom <= 0 && (
          <line
            x1="0"
            x2={W}
            y1={y(0)}
            y2={y(0)}
            stroke="var(--color-line)"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        )}
        <path d={area(() => 0, avail)} fill={LAYER_COLORS.available} fillOpacity="0.55" />
        <path
          d={area(avail, (p) => avail(p) + p.invested)}
          fill={LAYER_COLORS.invested}
          fillOpacity="0.55"
        />
        {showDebt && (
          <path
            d={area(
              (p) => Math.min(0, p.available) - p.debt,
              (p) => Math.min(0, p.available),
            )}
            fill={LAYER_COLORS.debt}
            fillOpacity="0.55"
          />
        )}
        {hover !== null && (
          <line
            x1={x(shown)}
            x2={x(shown)}
            y1="0"
            y2={H}
            stroke="var(--color-ink)"
            strokeOpacity="0.5"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
      <dl className={`mt-3 grid gap-2 text-[12.5px] ${showDebt ? 'grid-cols-3' : 'grid-cols-2'}`}>
        {(
          [
            ['Disponible', shown.available, LAYER_COLORS.available],
            ['Invertido', shown.invested, LAYER_COLORS.invested],
            ...(showDebt ? [['Deuda', shown.debt, LAYER_COLORS.debt] as const] : []),
          ] as const
        ).map(([label, cents, color]) => (
          <div key={label} className="min-w-0">
            <dt className="flex items-center gap-1.5 text-muted">
              <span
                aria-hidden
                className="size-2.5 shrink-0 rounded-[3px]"
                style={{ background: color }}
              />
              {label}
            </dt>
            <dd className="tabular mt-0.5 truncate text-[14px] font-semibold">{money(cents)}</dd>
          </div>
        ))}
      </dl>
    </figure>
  );
}

/** A tiny line of the total, for Inicio. */
export function NetWorthSpark({ points }: { points: readonly Point[] }) {
  const W = 120;
  const H = 36;
  const totals = points.map((p) => p.total);
  const min = Math.min(...totals);
  const max = Math.max(...totals);
  const span = max - min || 1;
  const d = points
    .map((p, i) => {
      const px = points.length > 1 ? (i / (points.length - 1)) * W : W / 2;
      return `${i ? 'L' : 'M'}${px.toFixed(1)} ${(3 + (1 - (p.total - min) / span) * (H - 6)).toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="h-9 w-28 text-hue"
      aria-hidden
    >
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
      />
    </svg>
  );
}
