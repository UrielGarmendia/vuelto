import type { AssetCategory } from '../external/provider';

/** One steady colour per asset class, so a class looks the same on every chart. */
export const CATEGORY_COLORS: Record<AssetCategory, string> = {
  Acciones: '#75AADB',
  CEDEARs: '#8FD18A',
  Bonos: '#B48EE0',
  ONs: '#E07A8C',
  FCI: '#5FC2B5',
  Cauciones: '#C9A66B',
  Otros: '#8C96A3',
};

export const MARKET_COLORS = { ARG: '#75AADB', USA: '#B48EE0' } as const;
export const MARKET_NAMES = { ARG: 'Argentina', USA: 'EE.UU.' } as const;
