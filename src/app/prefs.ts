import { useEffect } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { RateKind } from '../features/currency/rates';
import { setMoneyHidden } from '../lib/money';

export type Theme = 'light' | 'dark' | 'system';

export const homeWidgetNames = {
  dial: 'Dial del mes',
  balance: 'Saldo',
  surplus: 'Lo que te sobra',
  rates: 'Dólar',
  insight: 'Dato del mes',
  accounts: 'Cuentas',
  goals: 'Metas de ahorro',
  recent: 'Últimos movimientos',
} as const;
export type HomeWidget = keyof typeof homeWidgetNames;
export interface WidgetPref {
  id: HomeWidget;
  visible: boolean;
}
const defaultWidgets: WidgetPref[] = (Object.keys(homeWidgetNames) as HomeWidget[]).map((id) => ({
  id,
  visible: true,
}));

/** Stored order plus any widget added in a later version (at the end), unknown ids dropped. */
export function withAllWidgets(stored: readonly WidgetPref[] | undefined): WidgetPref[] {
  const known = (stored ?? []).filter((w) => w.id in homeWidgetNames);
  const missing = defaultWidgets.filter((d) => !known.some((w) => w.id === d.id));
  return [...known, ...missing];
}

interface Prefs {
  theme: Theme;
  reduceMotion: boolean;
  installDismissed: boolean;
  /** Which dollar converts USD into pesos. */
  rateKind: RateKind;
  setRateKind: (rateKind: RateKind) => void;
  /** Order and visibility of the blocks on Inicio. */
  homeWidgets: WidgetPref[];
  setHomeWidgets: (homeWidgets: WidgetPref[]) => void;
  setTheme: (theme: Theme) => void;
  setReduceMotion: (reduceMotion: boolean) => void;
  dismissInstall: () => void;
  /** Private mode: amounts show as "••••" everywhere. */
  privateMode: boolean;
  togglePrivateMode: () => void;
}

// The storage key is also read by the inline script in index.html.
export const usePrefs = create<Prefs>()(
  persist(
    (set) => ({
      theme: 'system',
      reduceMotion: false,
      installDismissed: false,
      rateKind: 'mep',
      setRateKind: (rateKind) => set({ rateKind }),
      homeWidgets: defaultWidgets,
      setHomeWidgets: (homeWidgets) => set({ homeWidgets }),
      setTheme: (theme) => set({ theme }),
      setReduceMotion: (reduceMotion) => set({ reduceMotion }),
      dismissInstall: () => set({ installDismissed: true }),
      privateMode: false,
      togglePrivateMode: () => set((s) => ({ privateMode: !s.privateMode })),
    }),
    { name: 'vuelto-prefs' },
  ),
);

// The flag changes before React redraws, so every amount formatted in that redraw follows it.
setMoneyHidden(usePrefs.getState().privateMode);
usePrefs.subscribe((s) => setMoneyHidden(s.privateMode));

/**
 * Subscribes a component to private mode, so its amounts redraw when it changes. Called once
 * per screen (its children redraw with it) and in memoized rows.
 */
export const useMoneyVisibility = () => usePrefs((s) => s.privateMode);

const themeColor = { light: '#ECEEF1', dark: '#000000' } as const;

/** Keeps <html data-theme>, the browser chrome color and the motion flag in sync with prefs. */
export function useApplyPrefs(): void {
  const theme = usePrefs((s) => s.theme);
  const reduceMotion = usePrefs((s) => s.reduceMotion);

  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const resolved = theme === 'system' ? (media.matches ? 'dark' : 'light') : theme;
      document.documentElement.dataset.theme = resolved;
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', themeColor[resolved]);
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);

  useEffect(() => {
    document.documentElement.dataset.reduceMotion = String(reduceMotion);
  }, [reduceMotion]);
}
