import { useRef } from 'react';
import { formatMoney } from '../../lib/money';
import type { Baseline, DialSummary, TickState } from './dial';
import './home.css';

const tickColor: Record<TickState, string> = {
  under: 'var(--color-hue)',
  over: 'var(--color-over)',
  spent: 'var(--color-hue)',
  quiet: 'var(--color-idle)',
  ahead: 'var(--color-idle)',
};

const CX = 180;
const CY = 176;
const START = -210;
const SWEEP = 240;
const rad = (deg: number) => (deg * Math.PI) / 180;

interface Props {
  ticks: TickState[];
  daily: number[];
  today: number;
  monthName: string;
  baseline: Baseline;
  summary: DialSummary;
  selected: number | null;
  onSelect: (day: number | null) => void;
}

/**
 * One tick per day of the month, each against the daily baseline. Tapping the ring (or the
 * arrow keys) picks a day; the centre then shows that day instead of the month.
 */
export function MonthDial({
  ticks,
  daily,
  today,
  monthName,
  baseline,
  summary,
  selected,
  onSelect,
}: Props) {
  const svg = useRef<SVGSVGElement>(null);
  const n = ticks.length;
  const angle = (i: number) => rad(START + (SWEEP * i) / (n - 1));

  function dayAt(e: React.PointerEvent) {
    const box = svg.current!.getBoundingClientRect();
    const scale = 360 / box.width;
    const x = (e.clientX - box.left) * scale - CX;
    const y = (e.clientY - box.top) * scale - CY;
    if (Math.hypot(x, y) < 70) return null; // the centre clears the selection
    let t = ((((Math.atan2(y, x) * 180) / Math.PI - START) % 360) + 360) % 360;
    if (t > SWEEP) t = t < SWEEP + (360 - SWEEP) / 2 ? SWEEP : 0;
    return Math.min(today, Math.round((t / SWEEP) * (n - 1)) + 1);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const step = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key];
    if (step) {
      e.preventDefault();
      onSelect(Math.min(today, Math.max(1, (selected ?? today) + step)));
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      onSelect(e.key === 'Home' ? 1 : today);
    } else if (e.key === 'Escape' && selected) {
      e.stopPropagation();
      onSelect(null);
    }
  }

  const day = selected ?? today;
  const valueText = `${day} de ${monthName}: ${formatMoney(daily[day - 1] ?? 0)}`;

  return (
    <div className="relative grid justify-items-center pt-2">
      <svg
        ref={svg}
        viewBox="0 0 360 300"
        className="w-full max-w-[360px] cursor-pointer overflow-visible outline-none focus-visible:outline-2 focus-visible:outline-hue"
        role="slider"
        tabIndex={0}
        aria-label="Día del mes"
        aria-valuemin={1}
        aria-valuemax={today}
        aria-valuenow={day}
        aria-valuetext={valueText}
        onPointerUp={(e) => {
          const d = dayAt(e);
          onSelect(d === selected ? null : d);
        }}
        onKeyDown={onKeyDown}
      >
        {ticks.map((st, i) => {
          const a = angle(i);
          const r2 = st === 'ahead' ? 150 : 162;
          const on = selected === i + 1;
          return (
            <g key={i} className="dial-day" style={{ opacity: selected && !on ? 0.32 : 1 }}>
              <line
                className="dial-tick"
                data-on={on}
                x1={CX + 132 * Math.cos(a)}
                y1={CY + 132 * Math.sin(a)}
                x2={CX + r2 * Math.cos(a)}
                y2={CY + r2 * Math.sin(a)}
                stroke={tickColor[st]}
                style={{ animationDelay: `${i * 26}ms` }}
              />
            </g>
          );
        })}
        {selected === null && (
          <circle
            cx={CX + 176 * Math.cos(angle(today - 1))}
            cy={CY + 176 * Math.sin(angle(today - 1))}
            r="3"
            fill="var(--color-ink)"
          />
        )}
      </svg>
      <div className="pointer-events-none absolute inset-x-0 top-[33%] text-center">
        {selected !== null ? (
          <>
            <p className="text-[13.5px] text-muted">
              {selected === today ? 'Hoy' : `${selected} de ${monthName}`}
            </p>
            <span className="wide mt-1 block text-[clamp(24px,7vw,30px)] leading-none font-extrabold">
              {formatMoney(daily[selected - 1] ?? 0)}
            </span>
            <p className="mt-2 text-[13.5px] text-muted">
              {baseline.perDay === undefined
                ? 'gastado ese día'
                : (daily[selected - 1] ?? 0) > baseline.perDay
                  ? `${formatMoney(Math.round(((daily[selected - 1] ?? 0) - baseline.perDay) / 100) * 100)} arriba ${baseline.mode === 'budget' ? 'del presupuesto diario' : 'de tu promedio'}`
                  : `dentro ${baseline.mode === 'budget' ? 'del presupuesto diario' : 'de tu promedio'}`}
            </p>
          </>
        ) : (
          <>
            {summary.mode === 'budget' && (
              <>
                <span className="wide block text-[clamp(44px,14vw,64px)] leading-none font-extrabold">
                  {summary.percentOfBudget} %
                </span>
                <p className="mt-2 text-[13.5px] text-muted">del presupuesto</p>
              </>
            )}
            {summary.mode === 'average' && (
              <>
                <span className="wide block text-[clamp(44px,14vw,64px)] leading-none font-extrabold">
                  {summary.percentVsAverage > 0 ? '+' : summary.percentVsAverage < 0 ? '−' : ''}
                  {Math.abs(summary.percentVsAverage)} %
                </span>
                <p className="mx-auto mt-2 max-w-[22ch] text-[13.5px] text-muted">
                  contra tu promedio a esta altura
                </p>
              </>
            )}
            {summary.mode === 'none' && (
              <>
                <span className="wide block text-[clamp(22px,6.6vw,27px)] leading-none font-extrabold">
                  {formatMoney(summary.spentCents)}
                </span>
                <p className="mt-2 text-[13.5px] text-muted">gastado en {monthName}</p>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
