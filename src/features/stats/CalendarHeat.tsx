import { useState } from 'react';
import { fromISODate } from '../../lib/dates';
import { formatMoney } from '../../lib/money';

const weekdays = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];
const dayFmt = new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric' });

/** Spending per day as a calendar: the more spent, the stronger the celeste. */
export function CalendarHeat({
  month,
  daily,
  lastDay,
}: {
  month: string;
  daily: number[];
  /** Days after this one have not happened yet. */
  lastDay: number;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  // Monday-first offset of the 1st.
  const lead = (fromISODate(`${month}-01`).getDay() + 6) % 7;
  const max = Math.max(...daily, 1);
  const iso = (d: number) => `${month}-${String(d).padStart(2, '0')}`;
  const label = (d: number) => dayFmt.format(fromISODate(iso(d)));
  const shown = picked ?? daily.indexOf(Math.max(...daily.slice(0, lastDay))) + 1;

  return (
    <section aria-labelledby="calendar-label" className="rounded-[24px] bg-flat p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="calendar-label" className="text-[16px] font-semibold">
          Calendario
        </h2>
        <p className="truncate text-[13px] text-faint" aria-live="polite">
          {daily[shown - 1]
            ? `${picked ? '' : 'Día más caro: '}${label(shown)}, ${formatMoney(daily[shown - 1]!)}`
            : picked
              ? `${label(shown)}: sin gastos`
              : 'Sin gastos'}
        </p>
      </div>
      <div
        className="mx-auto mt-3 grid max-w-[420px] grid-cols-7 gap-1.5"
        role="grid"
        aria-label="Gasto por día"
      >
        {weekdays.map((w) => (
          <span key={w} role="columnheader" className="text-center text-[11px] text-faint">
            {w}
          </span>
        ))}
        {Array.from({ length: lead }, (_, i) => (
          <span key={`b${i}`} aria-hidden />
        ))}
        {daily.map((cents, i) => {
          const d = i + 1;
          const future = d > lastDay;
          // Square root keeps small days visible next to the rent day.
          const level = cents ? 0.18 + 0.82 * Math.sqrt(cents / max) : 0;
          return (
            <button
              key={d}
              type="button"
              role="gridcell"
              disabled={future}
              aria-pressed={picked === d}
              aria-label={`${label(d)}: ${cents ? formatMoney(cents) : 'sin gastos'}`}
              onClick={() => setPicked(picked === d ? null : d)}
              className="relative grid aspect-square place-items-center rounded-[8px] bg-sunk text-[11.5px] tabular text-faint outline-offset-1 aria-pressed:outline-2 aria-pressed:outline-ink disabled:opacity-40"
            >
              <span
                aria-hidden
                className="absolute inset-0 rounded-[8px] bg-hue"
                style={{ opacity: level }}
              />
              <span
                className={`relative ${level > 0.75 ? 'font-semibold text-on-hue' : level > 0 ? 'text-ink' : ''}`}
              >
                {d}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
