import { AnimatePresence, m } from 'motion/react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { spring } from '../ui/motion';

export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  return (
    <AnimatePresence>
      {needRefresh && (
        <m.div
          role="status"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={spring.snappy}
          className="fixed inset-x-4 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-md items-center gap-3 rounded-md bg-ink py-2 pr-2 pl-4 text-ground dark:bg-flat-2 dark:text-ink"
        >
          <p className="flex-1 text-sm font-medium">Hay una versión nueva</p>
          <button
            type="button"
            onClick={() => setNeedRefresh(false)}
            className="min-h-11 rounded-sm px-3 text-sm opacity-70"
          >
            Después
          </button>
          <button
            type="button"
            onClick={() => updateServiceWorker(true)}
            className="min-h-11 rounded-sm bg-hue px-4 text-sm font-semibold text-on-hue"
          >
            Actualizar
          </button>
        </m.div>
      )}
    </AnimatePresence>
  );
}
