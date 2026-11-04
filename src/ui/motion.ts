import type { Transition } from 'motion/react';

export const spring = {
  snappy: { type: 'spring', stiffness: 500, damping: 35 },
  sheet: { type: 'spring', stiffness: 380, damping: 36 },
  // Critically damped: a money figure must never overshoot past its real value.
  number: { type: 'spring', stiffness: 170, damping: 27 },
} satisfies Record<string, Transition>;

export const duration = { fast: 0.15, base: 0.22, slow: 0.32 } as const;

export const ease = { out: [0.22, 1, 0.36, 1] } as const;

export const fade: Transition = { duration: duration.fast, ease: ease.out };

export const staggerMs = 35;
