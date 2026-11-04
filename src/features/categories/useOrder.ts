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
  useEffect(() => () => clearTimeout(timer.current), []);

  function onReorder(next: string[]) {
    setIds(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void saveOrder(table, next), 400);
  }

  return [ids, onReorder] as const;
}
