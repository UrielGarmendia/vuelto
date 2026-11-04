import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { db } from '../../db/db';
import type { Account, Category } from '../../db/types';

/** Id → record lookups for categories and accounts, including archived ones (old rows need them). */
export function useCatalog() {
  const categories = useLiveQuery(() => db.categories.toArray(), []);
  const accounts = useLiveQuery(() => db.accounts.toArray(), []);
  return useMemo(
    () => ({
      ready: categories !== undefined && accounts !== undefined,
      categories: new Map<string, Category>(categories?.map((c) => [c.id, c])),
      accounts: new Map<string, Account>(accounts?.map((a) => [a.id, a])),
    }),
    [categories, accounts],
  );
}
