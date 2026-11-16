import { create } from 'zustand';

interface CopilotSheet {
  open: boolean;
  /** Bumped on every open so the sheet starts empty. */
  session: number;
  openCopilot: () => void;
  close: () => void;
}

export const useCopilot = create<CopilotSheet>()((set) => ({
  open: false,
  session: 0,
  openCopilot: () => set((s) => ({ open: true, session: s.session + 1 })),
  close: () => set({ open: false }),
}));
