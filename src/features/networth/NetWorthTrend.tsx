import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronRight } from 'lucide-react';
import { db } from '../../db/db';
import { todayISO } from '../../lib/dates';
import { pct, signedMoney } from '../investments/format';
import { NetWorthSpark } from './NetWorthChart';
import { netWorthSeries, periodChange } from './networth';

/** Inside the balance card on Inicio: the last month as a small line, and this month's move. */
export function NetWorthTrend() {
  const days = useLiveQuery(() => db.netWorth.filter((d) => !d.deleted).toArray(), []);
  const today = todayISO();
  const points = days?.length ? netWorthSeries({ days, range: '1M', currency: 'ARS', today }) : [];
  const month = periodChange(points.filter((p) => p.date >= `${today.slice(0, 7)}-01`));

  return (
    <span className="mt-3 flex items-center gap-3 border-t border-line pt-3">
      <span
        className={`tabular min-w-0 flex-1 text-[13px] leading-snug ${
          !month || month.cents === 0 ? 'text-muted' : month.cents > 0 ? 'text-hue' : 'text-over'
        }`}
      >
        {month
          ? `Este mes ${signedMoney(month.cents)}${month.pct === undefined ? '' : ` · ${pct(month.pct)}`}`
          : 'Tu evolución arranca hoy'}
      </span>
      {points.length > 1 && <NetWorthSpark points={points} />}
      <ChevronRight aria-hidden className="size-5 shrink-0 text-faint" />
    </span>
  );
}
