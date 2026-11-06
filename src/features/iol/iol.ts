import { useLiveQuery } from 'dexie-react-hooks';
import { create } from 'zustand';
import { db, newMeta } from '../../db/db';
import type { Account } from '../../db/types';
import type { ExternalAccountProvider, Snapshot } from '../external/provider';
import { useSync } from '../sync/useSync';
import { normalizeBalance, normalizePortfolio } from './normalize';

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

/** Step 1: our server prepares IOL's authorization page; the browser goes there. */
export async function connectIol(): Promise<void> {
  const { url } = await post('/api/iol/start', {});
  if (!url) throw new IolError('IOL no respondió');
  location.assign(url);
}

/** Step 2, back from IOL: the sealed connection arrives in the URL fragment. */
export async function takeIolFromUrl(): Promise<'connected' | 'error' | null> {
  const hash = new URLSearchParams(location.hash.slice(1));
  const blob = hash.get('iol');
  const failed = hash.has('iol-error');
  if (!blob && !failed) return null;
  history.replaceState(history.state, '', location.pathname + location.search);
  if (!blob) return 'error';
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
export const iolProvider: ExternalAccountProvider = {
  id: 'iol',
  name: 'IOL',
  async fetchSnapshot() {
    const account = await findIolAccount();
    if (!account?.external) throw new IolError('IOL no está conectado', true);
    let blob = account.external.blob;
    // Balance first: if IOL's token gets refreshed, the portfolio call uses the new blob.
    const balance = await post('/api/iol/balance', { blob });
    if (balance.blob) blob = balance.blob;
    const portfolio = await post('/api/iol/portfolio', { blob });
    if (portfolio.blob) blob = portfolio.blob;
    if (blob !== account.external.blob)
      await db.accounts.update(account.id, {
        external: { ...account.external, blob },
        updatedAt: Date.now(),
        synced: 0,
      });
    const snapshot: Snapshot = {
      provider: 'iol',
      cash: normalizeBalance(balance.data),
      positions: normalizePortfolio(portfolio.data),
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
