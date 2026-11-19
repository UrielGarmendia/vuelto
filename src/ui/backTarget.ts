/**
 * Which screen each history entry shows, so a back link can say where it goes. Kept in
 * sessionStorage: a reload keeps the history, and so should the names.
 */
const KEY = 'vuelto-history-paths';

const read = (): Record<number, string> => {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? '{}') as Record<number, string>;
  } catch {
    return {};
  }
};

const idx = () => (window.history.state as { idx?: number } | null)?.idx ?? 0;

/** Notes the current entry's path (called while rendering the layout; idempotent). */
export function notePath(path: string) {
  const paths = read();
  if (paths[idx()] === path) return;
  paths[idx()] = path;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(paths));
  } catch {
    // Private mode without storage: back links fall back to their default name.
  }
}

/** The path of the entry before this one, when known. */
export const previousPath = (): string | undefined => (idx() > 0 ? read()[idx() - 1] : undefined);

const NAMES: [RegExp, string | ((m: RegExpMatchArray) => string)][] = [
  [/^\/$/, 'Inicio'],
  [/^\/movimientos\/?$/, 'Movimientos'],
  [/^\/movimientos\/.+/, 'Movimiento'],
  [/^\/estadisticas/, 'Estadísticas'],
  [/^\/ajustes\/?$/, 'Ajustes'],
  [/^\/ajustes\/categorias/, 'Categorías'],
  [/^\/ajustes\/cuentas/, 'Cuentas'],
  [/^\/ajustes\/presupuestos/, 'Presupuestos'],
  [/^\/ajustes\/recurrentes/, 'Recurrentes'],
  [/^\/ajustes\/metas/, 'Metas'],
  [/^\/ajustes\/reglas/, 'Reglas'],
  [/^\/ajustes\/inicio/, 'Personalizar Inicio'],
  [/^\/inversiones\/?$/, 'Inversiones'],
  [/^\/inversiones\/[^/]+\/([^/]+)/, (m) => decodeURIComponent(m[1]!)],
  [/^\/patrimonio/, 'Patrimonio'],
  [/^\/privacidad/, 'Privacidad'],
];

/** "Inicio", "Inversiones", "GGAL"… for a path; undefined for an unknown one. */
export function screenName(path: string | undefined): string | undefined {
  if (!path) return undefined;
  const clean = path.split(/[?#]/)[0]!;
  for (const [re, name] of NAMES) {
    const m = clean.match(re);
    if (m) return typeof name === 'string' ? name : name(m);
  }
  return undefined;
}
