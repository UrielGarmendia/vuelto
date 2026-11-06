import type { Position, Snapshot } from '../external/provider';

/**
 * IOL's answers, as its public API shapes them (estado de cuenta and portafolio), turned into
 * the provider-neutral snapshot. Anything unexpected is skipped instead of trusted.
 */

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const str = (v: unknown) => (typeof v === 'string' ? v : '');
const cents = (v: unknown) => Math.round((num(v) ?? 0) * 100);
const obj = (v: unknown): Record<string, unknown> =>
  typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {};

/** "peso_Argentino" → ARS, "dolar_Estadounidense" → USD. */
const currencyOf = (v: unknown): 'ARS' | 'USD' | undefined => {
  const s = str(v).toLowerCase();
  if (s.includes('dolar') || s === 'usd') return 'USD';
  if (s.includes('peso') || s === 'ars') return 'ARS';
  return undefined;
};

export function normalizeBalance(raw: unknown): Snapshot['cash'] {
  const cash = { ARS: 0, USD: 0 };
  const accounts = Array.isArray(obj(raw).cuentas) ? (obj(raw).cuentas as unknown[]) : [];
  for (const a of accounts) {
    const c = currencyOf(obj(a).moneda);
    if (c) cash[c] += cents(obj(a).disponible ?? obj(a).saldo);
  }
  return cash;
}

export function normalizePortfolio(raw: unknown): Position[] {
  const assets = Array.isArray(obj(raw).activos) ? (obj(raw).activos as unknown[]) : [];
  return assets.flatMap((a): Position[] => {
    const t = obj(obj(a).titulo);
    const currency = currencyOf(t.moneda);
    const value = num(obj(a).valorizado);
    if (!currency || value === undefined) return [];
    return [
      {
        symbol: str(t.simbolo),
        description: str(t.descripcion) || str(t.simbolo),
        type: str(t.tipo).toLowerCase() || 'otros',
        currency,
        quantity: num(obj(a).cantidad) ?? 0,
        valueCents: Math.round(value * 100),
        dayChangePct: num(obj(a).variacionDiaria),
        gainPct: num(obj(a).gananciaPorcentaje),
      },
    ];
  });
}
