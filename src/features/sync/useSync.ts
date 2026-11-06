import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { db } from '../../db/db';
import { deleteAll } from '../settings/backup';
import { AuthError, driveClient } from './drive';
import { CATALOG_TABLES, syncAll } from './engine';
import { fetchProfile, requestToken, revoke, type Profile, type Token } from './google';

export type SyncStatus =
  'idle' | 'syncing' | 'synced' | 'pending' | 'offline' | 'error' | 'reconnect';

interface SyncState {
  profile?: Profile;
  token?: Token;
  lastSyncAt?: number;
  status: SyncStatus;
  signIn: () => Promise<void>;
  reconnect: () => Promise<void>;
  signOut: (keepLocal: boolean) => Promise<void>;
  syncNow: () => Promise<void>;
}

let running: Promise<void> | undefined;
let again = false;

export const useSync = create<SyncState>()(
  persist(
    (set, get) => ({
      status: 'idle',

      async signIn() {
        const token = await requestToken();
        const profile = await fetchProfile(token.value);
        // Another account than before: forget which file versions this device had seen.
        if (get().profile?.sub !== profile.sub) await db.kv.delete('sync-versions');
        set({ token, profile, status: 'idle' });
        await get().syncNow();
      },

      async reconnect() {
        const token = await requestToken(get().profile?.email);
        set({ token, status: 'idle' });
        await get().syncNow();
      },

      async signOut(keepLocal) {
        const token = get().token;
        if (token) void revoke(token.value);
        set({ token: undefined, profile: undefined, lastSyncAt: undefined, status: 'idle' });
        await db.kv.delete('sync-versions');
        if (!keepLocal) await deleteAll();
      },

      async syncNow() {
        // One round at a time; a request during a round runs once more right after.
        if (running) {
          again = true;
          return running;
        }
        const { token, profile } = get();
        if (!profile) return;
        if (!token || token.expiresAt < Date.now()) {
          set({ status: 'reconnect' });
          return;
        }
        if (!navigator.onLine) {
          set({ status: 'offline' });
          return;
        }
        set({ status: 'syncing' });
        running = (async () => {
          try {
            await syncAll(driveClient(token.value));
            set({ status: 'synced', lastSyncAt: Date.now() });
          } catch (err) {
            if (err instanceof AuthError) set({ token: undefined, status: 'reconnect' });
            else {
              console.error(err);
              set({ status: navigator.onLine ? 'error' : 'offline' });
            }
          }
        })();
        await running;
        running = undefined;
        if (again) {
          again = false;
          await get().syncNow();
        }
      },
    }),
    {
      name: 'vuelto-google',
      partialize: ({ profile, token, lastSyncAt }) => ({ profile, token, lastSyncAt }),
    },
  ),
);

/** Local changes not yet in Drive, across every synced table. */
async function pendingCount() {
  let n = await db.transactions.where('synced').equals(0).count();
  for (const t of CATALOG_TABLES) n += await db.table(t).where('synced').equals(0).count();
  return n;
}

/** Syncs on open, when the connection or the app comes back, and a moment after changes. */
export function useSyncTriggers() {
  const signedIn = useSync((s) => !!s.profile);
  const pending = useLiveQuery(pendingCount, []);

  useEffect(() => {
    if (!signedIn) return;
    const run = () => void useSync.getState().syncNow();
    const onVisible = () => document.visibilityState === 'visible' && run();
    const onOffline = () => useSync.setState({ status: 'offline' });
    run();
    addEventListener('online', run);
    addEventListener('offline', onOffline);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      removeEventListener('online', run);
      removeEventListener('offline', onOffline);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [signedIn]);

  useEffect(() => {
    if (!signedIn || !pending) return;
    if (useSync.getState().status === 'synced') useSync.setState({ status: 'pending' });
    const t = setTimeout(() => void useSync.getState().syncNow(), 3000);
    return () => clearTimeout(t);
  }, [signedIn, pending]);
}
