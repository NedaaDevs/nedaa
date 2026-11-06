import type { RefObject } from "react";
import type { HostInstance } from "react-native";
import { create } from "zustand";

type WhatsNewSheetState = {
  // A counter, so a second request re-presents without needing a reset.
  openRequests: number;
  /** The view that opened the sheet; reader focus returns to it on close. */
  opener: RefObject<HostInstance | null> | null;
  requestOpen: (opener?: RefObject<HostInstance | null>) => void;
  clearOpener: () => void;
};

export const useWhatsNewSheetStore = create<WhatsNewSheetState>((set) => ({
  openRequests: 0,
  opener: null,
  requestOpen: (opener) =>
    set((s) => ({ openRequests: s.openRequests + 1, opener: opener ?? null })),
  clearOpener: () => set({ opener: null }),
}));
