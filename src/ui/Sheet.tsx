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
  // Wide screens get a centred dialog instead of a sheet from the bottom.
  const wide = typeof matchMedia !== 'undefined' && matchMedia('(min-width: 1024px)').matches;

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
                className="fixed inset-0 z-40 bg-[var(--scrim)]"
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
                className={`fixed z-50 flex flex-col overflow-y-auto overscroll-contain border-line bg-ground outline-none ${
                  wide
                    ? 'inset-x-0 top-[6dvh] mx-auto max-h-[88dvh] w-[460px] rounded-[30px] border pb-2'
                    : 'inset-x-0 bottom-0 mx-auto max-h-[94dvh] max-w-xl rounded-t-[30px] border-t pb-safe'
                }`}
                initial={wide ? { opacity: 0, scale: 0.96, y: 12 } : { y: '100%' }}
                animate={wide ? { opacity: 1, scale: 1, y: 0 } : { y: 0 }}
                exit={wide ? { opacity: 0, scale: 0.97, y: 8 } : { y: '100%' }}
                transition={wide ? { duration: duration.base, ease: ease.out } : spring.sheet}
                drag={wide ? false : 'y'}
                dragListener={false}
                dragControls={drag}
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={{ top: 0.05, bottom: 0.7 }}
                onDragEnd={onDragEnd}
              >
                <DragContext.Provider value={(e) => drag.start(e)}>
                  <SheetDragZone className="flex shrink-0 justify-center pt-2.5 pb-1.5">
                    <span
                      aria-hidden
                      className={`h-[5px] w-10 rounded-full bg-idle ${wide ? 'invisible' : ''}`}
                    />
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
