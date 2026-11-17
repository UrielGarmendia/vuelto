import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect } from 'react';
import { db } from '../../db/db';
import type { Account, Category, Rule } from '../../db/types';
import { useSync } from '../sync/useSync';
import type { CopilotDraft, Missing } from './parse';

/**
 * The optional server reading ("Mejorar con IA"). It exists only when the deploy has it
 * configured and the signed-in email is allowed; otherwise nothing of it shows and the
 * copilot stays fully on the device.
 */

const STATUS_KEY = 'assist-status';
const QUOTA_KEY = 'assist-quota';

interface Status {
  enabled: boolean;
  remaining?: number;
  at: number;
}

export class AssistError extends Error {}

/** What the server reads back: amounts in units, ids from the catalog sent, or null. */
interface Movement {
  type: CopilotDraft['type'];
  amount: number;
  currency: 'ARS' | 'USD';
  categoryId: string | null;
  accountId: string | null;
  toAccountId: string | null;
  date: string;
  installments: number | null;
  note: string;
  confidence: number;
}

function googleToken() {
  const t = useSync.getState().token;
  return t && t.expiresAt > Date.now() ? t.value : undefined;
}

async function call<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const token = googleToken();
  if (!token) throw new AssistError('Iniciá sesión con Google para usar la IA');
  const quota = (await db.kv.get(QUOTA_KEY))?.value as string | undefined;
  const res = await fetch(path, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, quota }),
  });
  const data = (await res.json().catch(() => ({}))) as T & {
    error?: string;
    quota?: string;
    remaining?: number;
  };
  if (!res.ok) throw new AssistError(data.error ?? 'La IA no respondió. Probá de nuevo.');
  if (data.quota) await db.kv.put({ key: QUOTA_KEY, value: data.quota });
  if (data.remaining !== undefined)
    await db.kv.put({
      key: STATUS_KEY,
      value: { enabled: true, remaining: data.remaining, at: Date.now() },
    });
  return data;
}

/** Asks the server whether the AI is on for this user; quiet about every failure. */
export async function refreshAssist(): Promise<void> {
  let status: Status = { enabled: false, at: Date.now() };
  if (googleToken() && navigator.onLine) {
    try {
      const s = await call<{ enabled: boolean; remaining?: number }>('/api/ai/status', {});
      status = { enabled: s.enabled, remaining: s.remaining, at: Date.now() };
    } catch {
      // Not configured, not allowed, offline: the copilot works the same on the device.
    }
  }
  await db.kv.put({ key: STATUS_KEY, value: status });
}

/** The sign-in state the status was last checked for, this session. */
let checkedFor: boolean | undefined;

/** The last known status; checked once per session and again when the sign-in changes. */
export function useAssist(): Status | undefined {
  const status = useLiveQuery(
    async () => (await db.kv.get(STATUS_KEY))?.value as Status | undefined,
  );
  const signedIn = useSync((s) => !!s.profile);
  useEffect(() => {
    if (checkedFor === signedIn) return;
    checkedFor = signedIn;
    void refreshAssist();
  }, [signedIn]);
  return signedIn ? status : undefined;
}

/** Only what the server needs to choose ids: names, types and kinds. */
export function catalogOf(categories: Category[], accounts: Account[], rules: Rule[]) {
  return {
    categories: categories
      .filter((c) => !c.deleted && !c.archived)
      .slice(0, 200)
      .map((c) => ({ id: c.id, name: c.name.slice(0, 60), type: c.type })),
    accounts: accounts
      .filter((a) => !a.deleted && !a.archived && !a.external && a.kind !== 'investment')
      .slice(0, 50)
      .map((a) => ({ id: a.id, name: a.name.slice(0, 60), kind: a.kind, currency: a.currency })),
    rules: rules
      .filter((r) => !r.deleted && r.enabled)
      .slice(0, 200)
      .map((r) => ({ match: r.match.slice(0, 40), categoryId: r.categoryId })),
  };
}

function toDraft(m: Movement, source: string): CopilotDraft {
  const missing: Missing[] = [];
  if (!m.amount) missing.push('amount');
  if (!m.accountId) missing.push('account');
  if (m.type === 'transfer' ? !m.toAccountId : !m.categoryId)
    missing.push(m.type === 'transfer' ? 'destination' : 'category');
  return {
    type: m.type,
    amountCents: Math.round(m.amount * 100),
    currency: m.currency,
    categoryId: m.categoryId ?? undefined,
    accountId: m.accountId ?? undefined,
    toAccountId: m.toAccountId ?? undefined,
    date: m.date,
    installments: m.installments ?? undefined,
    note: m.note,
    confidence: m.confidence,
    missing,
    source,
  };
}

type CatalogInput = ReturnType<typeof catalogOf>;

/** A piece of text the device could not settle, read by the server. */
export async function improveText(text: string, catalog: CatalogInput, today: string) {
  const { movements } = await call<{ movements: Movement[] }>('/api/ai/copilot', {
    text,
    catalog,
    today,
  });
  return movements.map((m) => toDraft(m, text));
}

/** A receipt the device could not read, read by the server; the photo is not kept there. */
export async function improvePhoto(photo: Blob, catalog: CatalogInput, today: string) {
  const bytes = new Uint8Array(await photo.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  const mediaType = ['image/webp', 'image/jpeg', 'image/png'].includes(photo.type)
    ? photo.type
    : 'image/jpeg';
  const { movement } = await call<{ movement: Movement }>('/api/ai/receipt', {
    image: btoa(binary),
    mediaType,
    catalog,
    today,
  });
  return toDraft(movement, movement.note ? `Ticket de ${movement.note}` : 'Ticket');
}
