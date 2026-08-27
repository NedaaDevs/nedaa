import { create } from "zustand";

type WhatsNewSheetState = {
  // A counter, so a second request re-presents without needing a reset.
  openRequests: number;
  requestOpen: () => void;
};

export const useWhatsNewSheetStore = create<WhatsNewSheetState>((set) => ({
  openRequests: 0,
  requestOpen: () => set((s) => ({ openRequests: s.openRequests + 1 })),
}));
