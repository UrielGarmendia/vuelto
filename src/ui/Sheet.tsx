import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, m, useDragControls, type PanInfo } from 'motion/react';
import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { duration, ease, spring } from './motion';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
}

const DragContext = createContext<((e: React.PointerEvent) => void) | null>(null);

/** Area that drags the sheet (e.g. the header). Keep interactive scrollers out of it. */
export function SheetDragZone({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  const start = useContext(DragContext);
  return (
    <div className={`cursor-grab touch-none ${className}`} onPointerDown={(e) => start?.(e)}>
      {children}
    </div>
  );
}

const CLOSE_OFFSET = 120;
const CLOSE_VELOCITY = 600;

/** Bottom sheet: Radix Dialog for focus/a11y, Motion for the spring and drag-to-close. */
export function Sheet({ open, onOpenChange, title, children }: Props) {
  const drag = useDragControls();

  // Scale the page behind (iOS style); CSS in styles.css reads these.
  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    root.style.setProperty('--sheet-origin-y', `${window.scrollY + window.innerHeight / 2}px`);
    root.dataset.sheet = 'open';
    return () => {
      delete root.dataset.sheet;
    };
  }, [open]);

  function onDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.y > CLOSE_OFFSET || info.velocity.y > CLOSE_VELOCITY) onOpenChange(false);
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <m.div
                className="fixed inset-0 z-40 bg-black/40"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: duration.base, ease: ease.out }}
              />
            </Dialog.Overlay>
            <Dialog.Content
              asChild
              forceMount
              aria-describedby={undefined}
              // Focus the sheet itself so no input pops the system keyboard.
              onOpenAutoFocus={(e) => {
                e.preventDefault();
                (e.currentTarget as HTMLElement | null)?.focus();
              }}
            >
              <m.div
                tabIndex={-1}
                className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[94dvh] max-w-lg flex-col rounded-t-[28px] bg-bg pb-safe shadow-[0_-8px_40px_-12px_rgb(0_0_0/0.25)] outline-none"
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={spring.sheet}
                drag="y"
                dragListener={false}
                dragControls={drag}
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={{ top: 0.05, bottom: 0.7 }}
                onDragEnd={onDragEnd}
              >
                <DragContext.Provider value={(e) => drag.start(e)}>
                  <SheetDragZone className="flex shrink-0 justify-center pt-2.5 pb-1.5">
                    <span aria-hidden className="h-1.5 w-10 rounded-full bg-line" />
                  </SheetDragZone>
                  <Dialog.Title className="sr-only">{title}</Dialog.Title>
                  {children}
                </DragContext.Provider>
              </m.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
