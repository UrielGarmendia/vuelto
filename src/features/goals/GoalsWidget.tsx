import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router';
import { viewTransitions } from '../../app/viewTransitions';
import { db } from '../../db/db';
import { formatMoney } from '../../lib/money';
import { GoalRing } from './GoalRing';

/** Up to three goals on Inicio; nothing when there are none. */
export function GoalsWidget() {
  const goals = useLiveQuery(() => db.goals.filter((g) => !g.deleted).toArray(), []);
  if (!goals?.length) return null;
  return (
    <section aria-labelledby="goals-label" className="rounded-[24px] bg-flat p-4">
      <div className="flex items-center justify-between px-1">
        <h2 id="goals-label" className="text-[16px] font-semibold">
          Metas
        </h2>
        <Link
          to="/ajustes/metas"
          viewTransition={viewTransitions}
          className="-mr-1 flex min-h-11 items-center gap-0.5 px-1 text-[13.5px] font-medium text-hue"
        >
          Ver <ChevronRight aria-hidden className="size-4" />
        </Link>
      </div>
      <ul className="grid gap-3">
        {goals.slice(0, 3).map((g) => (
          <li key={g.id} className="flex items-center gap-3">
            <GoalRing goal={g} size={52} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-medium">{g.name}</span>
              <span className="tabular block text-[13px] text-faint">
                {formatMoney(g.savedCents)} de {formatMoney(g.targetCents)}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
