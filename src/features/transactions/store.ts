import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface TxSheet {
  open: boolean;
  /** Set when editing an existing transaction. */
  editingId?: string;
  /** Bumped on every open so the form remounts with a fresh draft. */
  session: number;
  openNew: () => void;
  openEdit: (id: string) => void;
  close: () => void;
}

export const useTxSheet = create<TxSheet>()((set) => ({
  open: false,
  session: 0,
  openNew: () => set((s) => ({ open: true, editingId: undefined, session: s.session + 1 })),
  openEdit: (id) => set((s) => ({ open: true, editingId: id, session: s.session + 1 })),
  close: () => set({ open: false }),
}));

interface LastUsed {
  expenseCategoryId?: string;
  incomeCategoryId?: string;
  accountId?: string;
  remember: (p: Partial<Omit<LastUsed, 'remember'>>) => void;
}

/** Preselects what you used last so a repeat expense is amount + save. */
export const useLastUsed = create<LastUsed>()(
  persist((set) => ({ remember: (p) => set(p) }), { name: 'vuelto-last-used' }),
);
