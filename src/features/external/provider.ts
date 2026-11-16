/** A service whose balance shows inside Vuelto without creating movements (IOL first). */
export interface ExternalAccountProvider {
  id: string;
  name: string;
  fetchSnapshot(): Promise<Snapshot>;
}

export type AssetCategory =
  'Acciones' | 'CEDEARs' | 'Bonos' | 'ONs' | 'FCI' | 'Cauciones' | 'Otros';

export interface Position {
  symbol: string;
  description: string;
  /** Readable asset class. Snapshots cached before categories may hold a provider name. */
  type: AssetCategory | string;
  currency: 'ARS' | 'USD';
  quantity: number;
  valueCents: number;
  /** Today's change, in percent (1.5 = 1,5 %). */
  dayChangePct?: number;
}

/** One cash account at the provider, e.g. pesos, dollars in Argentina, dollars abroad. */
export interface CashAccount {
  id: string;
  label: string;
  currency: 'ARS' | 'USD';
  /** Settled cash today: available plus committed. */
  totalCents: number;
  availableCents: number;
}

export interface Snapshot {
  provider: string;
  /** Cash per currency, the sum of `accounts`. */
  cash: { ARS: number; USD: number };
  accounts?: CashAccount[];
  positions: Position[];
  fetchedAt: number;
}

/** Cents in pesos; dollars convert at `usdRate` and are left out without one. */
const inPesos = (cents: number, currency: 'ARS' | 'USD', usdRate?: number) =>
  currency === 'ARS' ? cents : usdRate ? Math.round(cents * usdRate) : 0;

/** What the positions are worth, in pesos. */
export function investedTotal(s: Snapshot, usdRate?: number): number {
  return s.positions.reduce((a, p) => a + inPesos(p.valueCents, p.currency, usdRate), 0);
}

/** Cash held at the provider, in pesos. */
export function cashTotal(s: Snapshot, usdRate?: number): number {
  return s.cash.ARS + inPesos(s.cash.USD, 'USD', usdRate);
}

/** Cash plus positions, in pesos; dollars convert at `usdRate` (left out without one). */
export function snapshotTotal(s: Snapshot, usdRate?: number): number {
  return cashTotal(s, usdRate) + investedTotal(s, usdRate);
}

/**
 * Change of the day, in percent, weighted by each position's value in pesos over the
 * positions that report one. Dollar positions count only with a rate.
 */
export function dayChange(s: Snapshot, usdRate?: number): number | undefined {
  let total = 0;
  let weighted = 0;
  for (const p of s.positions) {
    const value = inPesos(p.valueCents, p.currency, usdRate);
    if (p.dayChangePct === undefined || value <= 0) continue;
    total += value;
    weighted += p.dayChangePct * value;
  }
  return total ? weighted / total : undefined;
}
