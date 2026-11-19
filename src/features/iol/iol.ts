import { useLiveQuery } from 'dexie-react-hooks';
import { create } from 'zustand';
import { activateNewestWorker } from '../../app/serviceWorker';
import { recordNetWorth } from '../networth/networth';
import { db, newMeta } from '../../db/db';
import type { Account } from '../../db/types';
import type { ExternalAccountProvider, Snapshot } from '../external/provider';
import { useSync } from '../sync/useSync';
import {
  normalizeAum,
  normalizeBalance,
  normalizePortfolio,
  normalizePriceHistory,
  type AumPoint,
  type PricePoint,
} from './normalize';

export const IOL_NAME = 'IOL — Inversiones';
const SNAPSHOT_KEY = 'iol-snapshot';

export class IolError extends Error {
  constructor(
    message: string,
    readonly reconnect = false,
  ) {
    super(message);
  }
}

/** The linked account (one per user), if any. */
export const findIolAccount = () =>
  db.accounts.filter((a) => a.external?.provider === 'iol' && !a.deleted).first();

function googleToken(): string {
  const t = useSync.getState().token;
  if (!t || t.expiresAt < Date.now())
    throw new IolError('Reconectá Google para ver tu cuenta de IOL', false);
  return t.value;
}

async function post(path: string, body: unknown) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { Authorization: `Bearer ${googleToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    url?: string;
    data?: unknown;
    blob?: string;
  };
  if (!res.ok) throw new IolError(data.error ?? `Error ${res.status}`, res.status === 401);
  return data;
}

const RESUME_KEY = 'vuelto-iol-resume';

/** True once after a reload that `connectIol` started; the card then picks the flow back up. */
export function takeIolResume(): boolean {
  try {
    const pending = sessionStorage.getItem(RESUME_KEY) === '1';
    sessionStorage.removeItem(RESUME_KEY);
    return pending;
  } catch {
    return false;
  }
}

/** Step 1: our server prepares IOL's authorization page; the browser goes there. */
export async function connectIol(): Promise<void> {
  // IOL sends the user back to /api/iol/callback: an outdated service worker would answer that
  // with the app shell and the connection would be lost, so the newest one takes over first.
  let swapped: boolean;
  try {
    swapped = await activateNewestWorker();
  } catch (err) {
    console.error(err);
    throw new IolError('No se pudo preparar la app para conectar IOL. Probá de nuevo.');
  }
  if (swapped) {
    try {
      sessionStorage.setItem(RESUME_KEY, '1');
    } catch {
      // Without sessionStorage the user just taps the button again after the reload.
    }
    location.reload();
    return;
  }
  const { url } = await post('/api/iol/start', {});
  if (!url) throw new IolError('IOL no respondió');
  location.assign(url);
}

/** Step 2, back from IOL: the sealed connection arrives in the URL fragment. */
export async function takeIolFromUrl(): Promise<'connected' | 'denied' | 'failed' | null> {
  const hash = new URLSearchParams(location.hash.slice(1));
  const blob = hash.get('iol');
  const failure = hash.get('iol-error');
  if (!blob && failure === null) return null;
  history.replaceState(history.state, '', location.pathname + location.search);
  if (!blob) return failure === 'denied' ? 'denied' : 'failed';
  const existing = await findIolAccount();
  const external = { provider: 'iol' as const, blob, connectedAt: Date.now() };
  if (existing) {
    await db.accounts.update(existing.id, { external, updatedAt: Date.now(), synced: 0 });
  } else {
    await db.accounts.add({
      ...newMeta(),
      name: IOL_NAME,
      kind: 'investment',
      currency: 'ARS',
      initialBalanceCents: 0,
      color: '#75AADB',
      order: (await db.accounts.count()) + 1,
      archived: 0,
      external,
    });
  }
  return 'connected';
}

export async function disconnectIol(): Promise<void> {
  const account = await findIolAccount();
  if (account)
    await db.accounts.update(account.id, { deleted: 1, updatedAt: Date.now(), synced: 0 });
  await db.kv.delete(SNAPSHOT_KEY);
}

/** IOL as a provider: balance and portfolio through our read-only functions. */
let queue: Promise<unknown> = Promise.resolve();

/**
 * One read through our IOL functions. Reads go one at a time: any of them may hand back a
 * refreshed connection (IOL can rotate its refresh token), which is stored before the next
 * one starts, so a later failure cannot lose it.
 */
export function iolRead(path: string): Promise<unknown> {
  const run = async () => {
    const account = await findIolAccount();
    if (!account?.external) throw new IolError('IOL no está conectado', true);
    const external = account.external;
    const r = await post(path, { blob: external.blob });
    if (r.blob && r.blob !== external.blob) {
      await db.accounts.update(account.id, {
        external: { ...external, blob: r.blob },
        updatedAt: Date.now(),
        synced: 0,
      });
    }
    return r.data;
  };
  const next = queue.then(run, run);
  queue = next.catch(() => undefined);
  return next;
}

export type PriceRange = '1S' | '1M' | '3M' | '1A';
/** Markets IOL has daily bars for; anything else (funds) has no chart. */
export const CHART_MARKETS = ['BCBA', 'NYSE', 'NASDAQ', 'AMEX'];
const HISTORY_TTL = 60 * 60 * 1000;

/** Daily closes for one asset, cached for an hour. Undefined: IOL has no bars for it. */
export async function priceHistory(
  symbol: string,
  market: string,
  range: PriceRange,
): Promise<PricePoint[] | undefined> {
  if (!CHART_MARKETS.includes(market)) return undefined;
  const key = `iol-history:${market}:${symbol}:${range}`;
  const cached = (await db.kv.get(key))?.value as { at: number; points: PricePoint[] } | undefined;
  if (cached && Date.now() - cached.at < HISTORY_TTL) return cached.points;
  try {
    const q = new URLSearchParams({ symbol, market, range });
    const points = normalizePriceHistory(await iolRead(`/api/iol/history?${q}`));
    await db.kv.put({ key, value: { at: Date.now(), points } });
    return points.length ? points : undefined;
  } catch (err) {
    // Offline or IOL down: an old chart beats none.
    if (cached) return cached.points;
    // IOL answered but has no bars for this asset: that is "no chart", not a failure.
    if (navigator.onLine && err instanceof IolError && !err.reconnect) return undefined;
    throw err;
  }
}

export interface HoldingsHistory {
  at: number;
  partial: boolean;
  /** Each account's daily valuation, in pesos and MEP dollars. */
  ARG: AumPoint[];
  USA: AumPoint[];
}
// v2: earlier copies took a client id for the amount.
const HOLDINGS_KEY = 'iol-aum-v2';
const HOLDINGS_TTL = 12 * 60 * 60 * 1000;

/**
 * IOL's own day-by-day record of the holdings, a year back, to draw the net worth curve
 * before Vuelto's first day. While IOL is still filling it in ("Partial") it is asked again
 * on the next visit. Undefined when there is none.
 */
export async function holdingsHistory(): Promise<HoldingsHistory | undefined> {
  const cached = (await db.kv.get(HOLDINGS_KEY))?.value as HoldingsHistory | undefined;
  if (cached && !cached.partial && Date.now() - cached.at < HOLDINGS_TTL) return cached;
  if (!(await findIolAccount())) return undefined;
  try {
    const arg = normalizeAum(await iolRead('/api/iol/aum?country=ARG&days=366'));
    const usa = normalizeAum(await iolRead('/api/iol/aum?country=USA&days=366'));
    const history: HoldingsHistory = {
      at: Date.now(),
      partial: arg.partial || usa.partial,
      ARG: arg.points,
      USA: usa.points,
    };
    await db.kv.put({ key: HOLDINGS_KEY, value: history });
    return history;
  } catch (err) {
    console.error(err);
    return cached;
  }
}

export const iolProvider: ExternalAccountProvider = {
  id: 'iol',
  name: 'IOL',
  async fetchSnapshot() {
    const read = iolRead;
    const balance = await read('/api/iol/balance');
    const argentina = await read('/api/iol/portfolio?country=argentina');
    const unitedStates = await read('/api/iol/portfolio?country=estados_Unidos');
    const snapshot: Snapshot = {
      provider: 'iol',
      ...normalizeBalance(balance),
      positions: [...normalizePortfolio(argentina), ...normalizePortfolio(unitedStates)],
      fetchedAt: Date.now(),
    };
    await db.kv.put({ key: SNAPSHOT_KEY, value: snapshot });
    return snapshot;
  },
};

interface IolState {
  status: 'idle' | 'loading' | 'error' | 'reconnect';
  message?: string;
  refresh: () => Promise<void>;
}

export const useIolStatus = create<IolState>()((set, get) => ({
  status: 'idle',
  async refresh() {
    if (get().status === 'loading') return;
    set({ status: 'loading', message: undefined });
    try {
      await iolProvider.fetchSnapshot();
      set({ status: 'idle' });
      // Fresh IOL figures update today's net worth.
      void recordNetWorth().catch((err: unknown) => console.error(err));
    } catch (err) {
      const e = err instanceof IolError ? err : new IolError('No se pudo actualizar IOL');
      if (!(err instanceof IolError)) console.error(err);
      set({ status: e.reconnect ? 'reconnect' : 'error', message: e.message });
    }
  },
}));

/** The linked account and its last snapshot (cached on this device). */
export function useIol(): { account?: Account; snapshot?: Snapshot } | undefined {
  return useLiveQuery(async () => ({
    account: await findIolAccount(),
    snapshot: (await db.kv.get(SNAPSHOT_KEY))?.value as Snapshot | undefined,
  }));
}
