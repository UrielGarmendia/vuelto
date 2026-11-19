import { toISODate } from '../../lib/dates';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect } from 'react';
import { db } from '../../db/db';

export type RateKind = 'oficial' | 'blue' | 'mep';

export interface Rates {
  /** ARS per US dollar (selling price), per kind. */
  values: Partial<Record<RateKind, number>>;
  fetchedAt: number;
}

export const rateLabels: Record<RateKind, string> = {
  oficial: 'Oficial',
  blue: 'Blue',
  mep: 'MEP',
};

const SOURCE = 'https://dolarapi.com/v1/dolares';
const casa: Record<string, RateKind> = { oficial: 'oficial', blue: 'blue', bolsa: 'mep' };
/** A rate younger than this is not fetched again. */
const FRESH_MS = 6 * 60 * 60 * 1000;

/** Reads dolarapi's list; anything malformed is dropped rather than trusted. */
export function parseRates(body: unknown, now = Date.now()): Rates | null {
  if (!Array.isArray(body)) return null;
  const values: Rates['values'] = {};
  for (const item of body) {
    if (typeof item !== 'object' || item === null) continue;
    const { casa: c, venta } = item as { casa?: unknown; venta?: unknown };
    const kind = typeof c === 'string' ? casa[c] : undefined;
    if (kind && typeof venta === 'number' && Number.isFinite(venta) && venta > 0)
      values[kind] = venta;
  }
  return Object.keys(values).length ? { values, fetchedAt: now } : null;
}

/** The last quote of each day (dolarapi has no daily change of its own). */
export type RateHistory = Record<string, Rates['values']>;
export const HISTORY_KEY = 'rates-history';

/** Records a day's quote, keeping the last ten days. */
export function withDay(history: RateHistory, day: string, values: Rates['values']): RateHistory {
  const days = Object.entries({ ...history, [day]: values })
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-10);
  return Object.fromEntries(days);
}

/** Today's value of one dollar against the closest earlier day on record. */
export function dayChange(history: RateHistory, kind: RateKind, today: string) {
  const days = Object.keys(history).sort();
  const latest = [...days].reverse().find((d) => d <= today && history[d]?.[kind]);
  const value = latest ? history[latest]![kind] : undefined;
  const before = [...days].reverse().find((d) => d < (latest ?? today) && history[d]?.[kind]);
  const prev = before ? history[before]![kind] : undefined;
  return {
    value,
    prev,
    pct: value !== undefined && prev ? ((value - prev) / prev) * 100 : undefined,
  };
}

/** Fetches today's rates unless the stored ones are fresh; keeps the last good ones offline. */
export async function refreshRates(now = Date.now()): Promise<Rates | null> {
  const stored = (await db.kv.get('rates'))?.value as Rates | undefined;
  if (stored && now - stored.fetchedAt < FRESH_MS) return stored;
  try {
    const res = await fetch(SOURCE, { signal: AbortSignal.timeout(8000) });
    const parsed = res.ok ? parseRates(await res.json(), now) : null;
    if (parsed) {
      await db.kv.put({ key: 'rates', value: parsed });
      const history = (await db.kv.get(HISTORY_KEY))?.value as RateHistory | undefined;
      await db.kv.put({
        key: HISTORY_KEY,
        value: withDay(history ?? {}, toISODate(new Date(now)), parsed.values),
      });
      return parsed;
    }
  } catch {
    // Offline or blocked: the last stored rates stand in, and the UI says how old they are.
  }
  return stored ?? null;
}

/** The stored rates, refreshed in the background when stale. */
export function useRates(): Rates | null | undefined {
  const rates = useLiveQuery(async () => ((await db.kv.get('rates'))?.value as Rates) ?? null);
  useEffect(() => {
    void refreshRates();
  }, []);
  return rates;
}
