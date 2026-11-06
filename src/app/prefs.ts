import { useEffect } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { RateKind } from '../features/currency/rates';

export type Theme = 'light' | 'dark' | 'system';

interface Prefs {
  theme: Theme;
  reduceMotion: boolean;
  installDismissed: boolean;
  /** Which dollar converts USD into pesos. */
  rateKind: RateKind;
  setRateKind: (rateKind: RateKind) => void;
  setTheme: (theme: Theme) => void;
  setReduceMotion: (reduceMotion: boolean) => void;
  dismissInstall: () => void;
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
      setTheme: (theme) => set({ theme }),
      setReduceMotion: (reduceMotion) => set({ reduceMotion }),
      dismissInstall: () => set({ installDismissed: true }),
    }),
    { name: 'vuelto-prefs' },
  ),
);

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
