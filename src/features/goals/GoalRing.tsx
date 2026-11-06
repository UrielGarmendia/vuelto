import { m } from 'motion/react';
import type { Goal } from '../../db/types';

/** Progress ring that fills with a spring; complete goals glow celeste. */
export function GoalRing({ goal, size = 64 }: { goal: Goal; size?: number }) {
  const ratio = Math.min(1, goal.savedCents / goal.targetCents);
  const r = 26;
  return (
    <span
      className="relative grid shrink-0 place-items-center"
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 64 64" className="size-full -rotate-90" aria-hidden>
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--color-idle)" strokeWidth="7" />
        <m.circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke={goal.color}
          strokeWidth="7"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: ratio }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        />
      </svg>
      <span className="tabular absolute text-[12.5px] font-semibold">
        {Math.round(ratio * 100)} %
      </span>
    </span>
  );
}
