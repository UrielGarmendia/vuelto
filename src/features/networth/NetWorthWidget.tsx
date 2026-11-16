import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router';
import { viewTransitions } from '../../app/viewTransitions';
import { db } from '../../db/db';
import { todayISO } from '../../lib/dates';
import { formatMoney } from '../../lib/money';
import { pct, signedMoney } from '../investments/format';
import { NetWorthSpark } from './NetWorthChart';
import { netWorthSeries, periodChange } from './networth';

/** Inicio: the last month of net worth as a small line, and how it moved this month. */
export function NetWorthWidget() {
  const days = useLiveQuery(() => db.netWorth.filter((d) => !d.deleted).toArray(), []);
  if (!days?.length) return null;
  const today = todayISO();
  const points = netWorthSeries({ days, range: '1M', currency: 'ARS', today });
  if (!points.length) return null;
  const month = periodChange(points.filter((p) => p.date >= `${today.slice(0, 7)}-01`));
  const last = points[points.length - 1]!;

  return (
    <section aria-labelledby="networth-label">
      <Link
        to="/patrimonio"
        viewTransition={viewTransitions}
        className="rel flex items-center gap-4 rounded-[22px] p-4"
      >
        <span className="min-w-0 flex-1">
          <span id="networth-label" className="block text-[13.5px] text-muted">
            Evolución del patrimonio
          </span>
          <span className="tabular block truncate text-[18px] font-bold">
            {formatMoney(last.total)}
          </span>
          <span
            className={`tabular block truncate text-[12.5px] ${
              !month || month.cents === 0
                ? 'text-faint'
                : month.cents > 0
                  ? 'text-hue'
                  : 'text-over'
            }`}
          >
            {month
              ? `Este mes ${signedMoney(month.cents)}${month.pct === undefined ? '' : ` · ${pct(month.pct)}`}`
              : 'La curva arranca hoy'}
          </span>
        </span>
        {points.length > 1 && <NetWorthSpark points={points} />}
        <ChevronRight aria-hidden className="size-5 shrink-0 text-faint" />
      </Link>
    </section>
  );
}
