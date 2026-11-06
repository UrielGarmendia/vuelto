import { describe, expect, it } from 'vitest';
import { dialBaseline, dialSummary, dialTicks } from './dial';

const daily = [520000, 0, 9850, 6432, 1500, 0]; // cents per day, 6-day month for brevity

describe('dialBaseline', () => {
  it('uses the budget spread over the month when there is one', () => {
    expect(dialBaseline(600000, [], 6)).toEqual({ mode: 'budget', perDay: 100000 });
  });

  it('falls back to the daily average of the last three months with spending', () => {
    const past = [
      { days: 31, spentCents: 3100 },
      { days: 30, spentCents: 6000 },
      { days: 31, spentCents: 0 }, // not using the app yet: ignored
      { days: 31, spentCents: 9300 },
      { days: 30, spentCents: 99999 }, // fourth month with spending: outside the window
    ];
    const b = dialBaseline(undefined, past, 30);
    expect(b.mode).toBe('average');
    expect(b.perDay).toBeCloseTo((3100 + 6000 + 9300) / (31 + 30 + 31));
  });

  it('a zero budget counts as no budget', () => {
    expect(dialBaseline(0, [{ days: 30, spentCents: 3000 }], 30).mode).toBe('average');
  });

  it('has no baseline for a new user', () => {
    expect(dialBaseline(undefined, [], 30)).toEqual({ mode: 'none' });
    expect(dialBaseline(undefined, [{ days: 30, spentCents: 0 }], 30)).toEqual({ mode: 'none' });
  });
});

describe('dialTicks', () => {
  it('marks each past day under or over the daily baseline and the rest ahead', () => {
    expect(dialTicks(daily, 4, { mode: 'budget', perDay: 8000 })).toEqual([
      'over',
      'under',
      'over',
      'under',
      'ahead',
      'ahead',
    ]);
  });

  it('a day exactly on the baseline is within it', () => {
    expect(dialTicks([8000], 1, { mode: 'average', perDay: 8000 })).toEqual(['under']);
  });

  it('without a baseline only says which days had spending', () => {
    expect(dialTicks(daily, 3, { mode: 'none' })).toEqual([
      'spent',
      'quiet',
      'spent',
      'ahead',
      'ahead',
      'ahead',
    ]);
  });
});

describe('dialSummary', () => {
  it('reports the share of the budget spent', () => {
    expect(dialSummary(124934000, 22, 30, { mode: 'budget', perDay: 150000000 / 30 })).toEqual({
      mode: 'budget',
      percentOfBudget: 83,
    });
  });

  it('compares spending so far with what the average would have spent by today', () => {
    // Average 1000/day, 10 days in, spent 11 200: 12 % more.
    expect(dialSummary(11200, 10, 30, { mode: 'average', perDay: 1000 })).toEqual({
      mode: 'average',
      percentVsAverage: 12,
    });
    expect(dialSummary(9000, 10, 30, { mode: 'average', perDay: 1000 })).toEqual({
      mode: 'average',
      percentVsAverage: -10,
    });
  });

  it('shows the amount when there is nothing to compare with', () => {
    expect(dialSummary(5000, 3, 30, { mode: 'none' })).toEqual({ mode: 'none', spentCents: 5000 });
  });
});
