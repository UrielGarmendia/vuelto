import { describe, expect, it } from 'vitest';
import { screenName } from './backTarget';

describe('screenName', () => {
  it.each([
    ['/', 'Inicio'],
    ['/movimientos', 'Movimientos'],
    ['/movimientos/abc', 'Movimiento'],
    ['/ajustes', 'Ajustes'],
    ['/ajustes/cuentas#iol=x', 'Cuentas'],
    ['/ajustes/reglas', 'Reglas'],
    ['/inversiones', 'Inversiones'],
    ['/inversiones/BCBA/GGAL', 'GGAL'],
    ['/patrimonio?x=1', 'Patrimonio'],
  ])('%s → %s', (path, name) => {
    expect(screenName(path)).toBe(name);
  });

  it('knows nothing of other paths', () => {
    expect(screenName('/nada')).toBeUndefined();
    expect(screenName(undefined)).toBeUndefined();
  });
});
