import { m } from 'motion/react';
import { useId } from 'react';
import { duration, ease } from './motion';

interface Props {
  values: readonly number[];
  className?: string;
}

const W = 300;
const H = 64;

/** Small area chart; draws itself in on mount. Decorative: callers give the summary in text. */
export function Sparkline({ values, className }: Props) {
  const id = useId();
  const max = Math.max(...values, 1);
  const step = values.length > 1 ? W / (values.length - 1) : W;
  const points = values.map((v, i) => [i * step, H - 4 - (v / max) * (H - 8)] as const);
  const line = points
    .map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`)
    .join('');
  const area = `${line}L${W},${H}L0,${H}Z`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      aria-hidden
      className={`h-16 w-full overflow-visible text-accent ${className ?? ''}`}
    >
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.22" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <m.path
        d={area}
        fill={`url(#${id})`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: duration.slow, delay: 0.25, ease: ease.out }}
      />
      <m.path
        d={line}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.6, ease: ease.out }}
      />
    </svg>
  );
}
