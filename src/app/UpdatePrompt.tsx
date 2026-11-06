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
          className="fixed inset-x-4 bottom-[calc(6.5rem+env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-md items-center gap-3 rounded-[20px] border border-line bg-flat-2 py-2 pr-2 pl-4 lg:bottom-6 lg:left-[232px]"
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
            className="rel go min-h-11 rounded-[14px] px-4 text-sm font-bold"
          >
            Actualizar
          </button>
        </m.div>
      )}
    </AnimatePresence>
  );
}
