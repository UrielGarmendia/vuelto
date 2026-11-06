/** A service whose balance shows inside Vuelto without creating movements (IOL first). */
export interface ExternalAccountProvider {
  id: string;
  name: string;
  fetchSnapshot(): Promise<Snapshot>;
}

export interface Position {
  symbol: string;
  description: string;
  /** Asset class as the provider names it: acciones, bonos, cedears, fci… */
  type: string;
  currency: 'ARS' | 'USD';
  quantity: number;
  valueCents: number;
  /** Today's change, in percent. */
  dayChangePct?: number;
  /** Gain since bought, in percent. */
  gainPct?: number;
}

export interface Snapshot {
  provider: string;
  cash: { ARS: number; USD: number };
  positions: Position[];
  fetchedAt: number;
}

/** Cash plus positions, in pesos; dollars convert at `usdRate` (left out without one). */
export function snapshotTotal(s: Snapshot, usdRate?: number): number {
  const usd = (c: number) => (usdRate ? Math.round(c * usdRate) : 0);
  const positions = s.positions.reduce(
    (a, p) => a + (p.currency === 'ARS' ? p.valueCents : usd(p.valueCents)),
    0,
  );
  return s.cash.ARS + usd(s.cash.USD) + positions;
}

/** Value-weighted change of the day, in percent, over the positions that report one. */
export function dayChange(s: Snapshot): number | undefined {
  const withChange = s.positions.filter((p) => p.dayChangePct !== undefined && p.valueCents > 0);
  const total = withChange.reduce((a, p) => a + p.valueCents, 0);
  if (!total) return undefined;
  return withChange.reduce((a, p) => a + p.dayChangePct! * p.valueCents, 0) / total;
}
