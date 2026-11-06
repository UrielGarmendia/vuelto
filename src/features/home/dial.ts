/**
 * The month dial: one tick per day, each compared with a daily baseline.
 * The baseline is the budget spread over the month when there is one, otherwise the daily
 * average of the last complete months, otherwise nothing (a new user sees which days had
 * spending, with no judgement).
 */

export type DialMode = 'budget' | 'average' | 'none';
export type TickState = 'under' | 'over' | 'spent' | 'quiet' | 'ahead';

export interface Baseline {
  mode: DialMode;
  /** Cents per day the month is measured against; absent in 'none'. */
  perDay?: number;
}

export interface MonthTotal {
  days: number;
  spentCents: number;
}

/** How many past months the average looks at. */
export const AVERAGE_MONTHS = 3;

export function dialBaseline(
  budgetCents: number | undefined,
  pastMonths: readonly MonthTotal[],
  daysInMonth: number,
): Baseline {
  if (budgetCents && budgetCents > 0) {
    return { mode: 'budget', perDay: budgetCents / daysInMonth };
  }
  // Most recent first; months with no spending at all are the app not being used yet.
  const used = pastMonths.filter((m) => m.spentCents > 0).slice(0, AVERAGE_MONTHS);
  if (used.length === 0) return { mode: 'none' };
  const spent = used.reduce((a, m) => a + m.spentCents, 0);
  const days = used.reduce((a, m) => a + m.days, 0);
  return { mode: 'average', perDay: spent / days };
}

export function dialTicks(
  daily: readonly number[],
  today: number,
  baseline: Baseline,
): TickState[] {
  return daily.map((cents, i) => {
    if (i + 1 > today) return 'ahead';
    if (baseline.perDay === undefined) return cents > 0 ? 'spent' : 'quiet';
    return cents > baseline.perDay ? 'over' : 'under';
  });
}

export type DialSummary =
  | { mode: 'budget'; percentOfBudget: number }
  | { mode: 'average'; percentVsAverage: number }
  | { mode: 'none'; spentCents: number };

/**
 * The figure in the dial's centre. With a budget: share of the month's budget already
 * spent. With an average: spending so far against what the average would have spent by
 * today (+12 means 12 % more). Without either: the amount spent.
 */
export function dialSummary(
  spentSoFar: number,
  today: number,
  daysInMonth: number,
  baseline: Baseline,
  /** What past months had spent by today; when known it beats the straight per-day line. */
  expectedSoFar?: number,
): DialSummary {
  if (baseline.mode === 'budget') {
    return {
      mode: 'budget',
      percentOfBudget: Math.round((spentSoFar / (baseline.perDay! * daysInMonth)) * 100),
    };
  }
  if (baseline.mode === 'average') {
    const expected = expectedSoFar || baseline.perDay! * today;
    return { mode: 'average', percentVsAverage: Math.round((spentSoFar / expected - 1) * 100) };
  }
  return { mode: 'none', spentCents: spentSoFar };
}
