import { AnimatePresence, m } from 'motion/react';
import { spring } from './motion';
import { useToasts } from './toast';

export function Toaster() {
  const { toasts, dismiss } = useToasts();
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-4 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-40 mx-auto max-w-md"
    >
      <AnimatePresence>
        {toasts.map((t) => (
          <m.div
            key={t.id}
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, transition: { duration: 0.15 } }}
            transition={spring.snappy}
            className="pointer-events-auto flex min-h-12 items-center gap-2 rounded-md bg-ink py-1.5 pr-1.5 pl-4 text-ground dark:bg-flat-2 dark:text-ink"
          >
            <p className="flex-1 text-sm font-medium">{t.message}</p>
            {t.action && (
              <button
                type="button"
                onClick={() => {
                  t.action!.onClick();
                  dismiss(t.id);
                }}
                className="min-h-11 rounded-sm px-3 text-sm font-semibold text-hue"
              >
                {t.action.label}
              </button>
            )}
          </m.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
