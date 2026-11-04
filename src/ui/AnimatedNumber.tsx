import { m, useReducedMotion, useSpring, useTransform } from 'motion/react';
import { useEffect } from 'react';
import { usePrefs } from '../app/prefs';
import { formatMoney, type Currency } from '../lib/money';
import { spring } from './motion';

interface Props {
  cents: number;
  currency?: Currency;
  className?: string;
}

/** Money that counts toward its new value with a spring (starts from 0 on mount). */
export function AnimatedNumber({ cents, currency = 'ARS', className }: Props) {
  const systemReduce = useReducedMotion();
  const appReduce = usePrefs((s) => s.reduceMotion);
  const reduce = !!systemReduce || appReduce;
  const value = useSpring(reduce ? cents : 0, spring.number);
  // Decide decimals from the target so the width doesn't jitter while counting.
  const decimals = cents % 100 !== 0;
  const text = useTransform(value, (v) => formatMoney(Math.round(v), currency, { decimals }));

  useEffect(() => {
    if (reduce) value.jump(cents);
    else value.set(cents);
  }, [cents, reduce, value]);

  return (
    <span className={`tabular ${className ?? ''}`}>
      <span className="sr-only">{formatMoney(cents, currency)}</span>
      <m.span aria-hidden>{text}</m.span>
    </span>
  );
}
