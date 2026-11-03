import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { router } from './app/router';
import { db, requestPersistentStorage } from './db/db';
import './styles.css';

// Ask once; the browser remembers the grant.
void db.kv.get('storagePersisted').then((kv) => {
  if (!kv?.value) return requestPersistentStorage();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
