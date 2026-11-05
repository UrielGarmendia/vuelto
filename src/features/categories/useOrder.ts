import { useEffect, useRef, useState } from 'react';
import { saveOrder } from '../../db/catalog';

/**
 * Local order for a Reorder.Group, saved shortly after the last move so a drag
 * doesn't write on every frame. Resyncs when the stored list changes (add/archive).
 */
export function useOrder(table: 'categories' | 'accounts', storedIds: readonly string[]) {
  const key = storedIds.join(',');
  const [prevKey, setPrevKey] = useState(key);
  const [ids, setIds] = useState<string[]>([...storedIds]);
  if (key !== prevKey) {
    setPrevKey(key);
    setIds([...storedIds]);
  }

  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pending = useRef<string[] | null>(null);

  useEffect(() => {
    const flush = () => {
      clearTimeout(timer.current);
      if (pending.current) void saveOrder(table, pending.current);
      pending.current = null;
    };
    // Leaving the page or closing the app (iOS: swipe away fires "hidden") must not lose a move.
    const onHide = () => document.visibilityState === 'hidden' && flush();
    document.addEventListener('visibilitychange', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      flush();
    };
  }, [table]);

  function onReorder(next: string[]) {
    setIds(next);
    pending.current = next;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      pending.current = null;
      void saveOrder(table, next);
    }, 400);
  }

  return [ids, onReorder] as const;
}
