import { create } from 'zustand';

interface Toast {
  id: number;
  message: string;
  action?: { label: string; onClick: () => void };
}

interface ToastStore {
  toasts: Toast[];
  dismiss: (id: number) => void;
}

export const useToasts = create<ToastStore>()((set) => ({
  toasts: [],
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

let nextId = 1;

export function toast(message: string, action?: Toast['action'], durationMs = 5000): void {
  const id = nextId++;
  // Only one toast at a time keeps the thumb area clear.
  useToasts.setState({ toasts: [{ id, message, action }] });
  setTimeout(() => useToasts.getState().dismiss(id), durationMs);
}
