import { describe, expect, it } from 'vitest';
import { addDays, formatDay, toISODate } from './dates';

const now = new Date(2026, 10, 3, 23, 30); // 3 Nov 2026, 23:30 local

describe('dates', () => {
  it('uses the local calendar day, not UTC', () => {
    expect(toISODate(now)).toBe('2026-11-03');
  });

  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-11-01', -1)).toBe('2026-10-31');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('labels days relative to today', () => {
    expect(formatDay('2026-11-03', now)).toBe('Hoy');
    expect(formatDay('2026-11-02', now)).toBe('Ayer');
    expect(formatDay('2026-11-01', now)).toBe('Domingo, 1 de noviembre');
    expect(formatDay('2025-12-24', now)).toBe('24 de diciembre de 2025');
  });
});
