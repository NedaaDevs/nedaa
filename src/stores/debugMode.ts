import { create } from "zustand";

interface DebugModeState {
  isEnabled: boolean;
  toggle: () => void;
}

export const useDebugModeStore = create<DebugModeState>()((set) => ({
  isEnabled: false,
  toggle: () => set((state) => ({ isEnabled: !state.isEnabled })),
}));
