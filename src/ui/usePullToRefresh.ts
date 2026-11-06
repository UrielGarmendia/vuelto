import { useEffect, useRef } from 'react';

/** Pull down at the top of the page to refresh (touch screens). */
export function usePullToRefresh(onRefresh: () => void) {
  const start = useRef<number | null>(null);
  useEffect(() => {
    const down = (e: TouchEvent) => {
      start.current = scrollY <= 0 ? e.touches[0]!.clientY : null;
    };
    const up = (e: TouchEvent) => {
      if (start.current !== null && e.changedTouches[0]!.clientY - start.current > 80) onRefresh();
      start.current = null;
    };
    addEventListener('touchstart', down, { passive: true });
    addEventListener('touchend', up, { passive: true });
    return () => {
      removeEventListener('touchstart', down);
      removeEventListener('touchend', up);
    };
  }, [onRefresh]);
}
