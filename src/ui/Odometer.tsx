import { useEffect, useState } from 'react';
import { formatMoney } from '../lib/money';
import './odometer.css';

/**
 * Money whose digits roll like a counter. Each digit is a 0–9 column moved with transform,
 * so the browser animates it on the compositor. Columns are keyed from the right so units
 * stay units when the number gains a digit.
 */
export function Odometer({ cents, className }: { cents: number; className?: string }) {
  // Start from zeros of the same shape, then roll to the value after the first paint.
  const target = formatMoney(cents);
  const [shown, setShown] = useState(() => target.replace(/\d/g, '0'));
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(target));
    return () => cancelAnimationFrame(id);
  }, [target]);

  const chars = [...shown];
  return (
    <span className={`odo ${className ?? ''}`}>
      <span className="sr-only">{target}</span>
      <span aria-hidden className="odo-row">
        {chars.map((ch, i) => {
          const key = chars.length - i;
          if (!/\d/.test(ch)) return <span key={`s${key}`}>{ch}</span>;
          return (
            <span key={`d${key}`} className="odo-cell">
              <span className="odo-col" style={{ transform: `translateY(${-Number(ch) * 10}%)` }}>
                {'0123456789'.split('').map((d) => (
                  <span key={d}>{d}</span>
                ))}
              </span>
            </span>
          );
        })}
      </span>
    </span>
  );
}
