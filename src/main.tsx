import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { router } from './app/router';
import { LockGate } from './features/lock/LockGate';
import { db, requestPersistentStorage } from './db/db';
import './styles.css';

// Ask once; the browser remembers the grant.
void db.kv.get('storagePersisted').then((kv) => {
  if (!kv?.value) return requestPersistentStorage();
});

// A reload, or the system reopening the installed app, starts at the top: scroll positions
// are only restored when going back and forth within this visit.
sessionStorage.removeItem('react-router-scroll-positions');
history.scrollRestoration = 'manual';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LockGate>
      <RouterProvider router={router} />
    </LockGate>
  </StrictMode>,
);
