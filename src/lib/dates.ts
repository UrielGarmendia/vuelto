const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar date as YYYY-MM-DD (not UTC, so late-night entries land on the right day). */
export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y!, m! - 1, d!);
}

export function todayISO(now = new Date()): string {
  return toISODate(now);
}

export function addDays(iso: string, days: number): string {
  const d = fromISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

const weekdayLong = new Intl.DateTimeFormat('es-AR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});
const withYear = new Intl.DateTimeFormat('es-AR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
const short = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short' });

/** "Hoy", "Ayer", "lunes 3 de noviembre" or "3 de noviembre de 2025" for other years. */
export function formatDay(iso: string, now = new Date()): string {
  const today = todayISO(now);
  if (iso === today) return 'Hoy';
  if (iso === addDays(today, -1)) return 'Ayer';
  const d = fromISODate(iso);
  const label = d.getFullYear() === now.getFullYear() ? weekdayLong.format(d) : withYear.format(d);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function formatShortDay(iso: string): string {
  return short.format(fromISODate(iso));
}

/** Same day `n` months later, clamped to the month's last day (31 Jan + 1 → 28/29 Feb). */
export function addMonthsISO(iso: string, n: number, day = Number(iso.slice(8))): string {
  const [y, m] = iso.split('-').map(Number);
  const first = new Date(y!, m! - 1 + n, 1);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  return toISODate(new Date(first.getFullYear(), first.getMonth(), Math.min(day, last)));
}
