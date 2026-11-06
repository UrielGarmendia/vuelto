import { Share, SquarePlus, X } from 'lucide-react';
import { AnimatePresence, m } from 'motion/react';
import { useEffect, useState } from 'react';
import { spring } from '../ui/motion';
import { usePrefs } from './prefs';

// Not in lib.dom yet: Chromium-only event.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const isStandalone = () =>
  matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

// iPadOS reports itself as a Mac, so check touch support too.
const isIOS = () =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) ||
  (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1);

export function InstallBanner() {
  const dismissed = usePrefs((s) => s.installDismissed);
  const dismiss = usePrefs((s) => s.dismissInstall);
  const [ios] = useState(isIOS);
  const [standalone] = useState(isStandalone);
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setPromptEvent(null);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const show = !dismissed && !standalone && (ios || promptEvent !== null);

  async function install() {
    if (!promptEvent) return;
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    setPromptEvent(null);
    if (outcome === 'dismissed') dismiss();
  }

  return (
    <AnimatePresence>
      {show && (
        <m.aside
          aria-label="Instalá Vuelto"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={spring.snappy}
          className="fixed inset-x-3 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-20 mx-auto max-w-md rounded-[22px] border border-line bg-flat p-4 lg:bottom-6 lg:left-[232px]"
        >
          <div className="flex items-start gap-3">
            <img src="/pwa-64x64.png" alt="" className="size-11 rounded-[12px]" />
            <div className="flex-1">
              <p className="font-semibold">Instalá Vuelto</p>
              {ios ? (
                <ol className="mt-1 space-y-1 text-sm text-muted">
                  <li className="flex items-center gap-1.5">
                    1. Tocá <Share aria-label="Compartir" className="size-4 text-ink" /> en la barra
                  </li>
                  <li className="flex items-center gap-1.5">
                    2. Elegí <SquarePlus aria-hidden className="size-4 text-ink" />
                    <span className="text-ink">Agregar a inicio</span>
                  </li>
                </ol>
              ) : (
                <p className="mt-0.5 text-sm text-muted">
                  Abrila como una app, también sin conexión.
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Cerrar"
              className="-mt-2 -mr-2 grid size-11 place-items-center rounded-sm text-muted"
            >
              <X aria-hidden className="size-5" />
            </button>
          </div>
          {!ios && (
            <button
              type="button"
              onClick={install}
              className="rel go mt-3 min-h-12 w-full rounded-[16px] text-[15px] font-bold"
            >
              Instalar
            </button>
          )}
        </m.aside>
      )}
    </AnimatePresence>
  );
}
