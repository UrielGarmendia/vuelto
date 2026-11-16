import { useSyncExternalStore } from 'react';

const subscribe = (cb: () => void) => {
  addEventListener('online', cb);
  addEventListener('offline', cb);
  return () => {
    removeEventListener('online', cb);
    removeEventListener('offline', cb);
  };
};

/** Whether the browser thinks it has a connection, updated live. */
export const useOnline = () =>
  useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
