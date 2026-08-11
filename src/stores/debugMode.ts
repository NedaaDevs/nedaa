import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import Storage from "expo-sqlite/kv-store";

interface DebugModeState {
  isEnabled: boolean;
  toggle: () => void;
}

// Persisted through the synchronous kv-store API so the flag survives restarts
// and headless background launches, and hydrates before the first log line.
// An async storage here would leave every background run with the default.
const syncStorage = {
  getItem: (name: string) => Storage.getItemSync(name),
  setItem: (name: string, value: string) => Storage.setItemSync(name, value),
  removeItem: (name: string) => {
    Storage.removeItemSync(name);
  },
};

export const useDebugModeStore = create<DebugModeState>()(
  persist(
    (set) => ({
      isEnabled: false,
      toggle: () => set((state) => ({ isEnabled: !state.isEnabled })),
    }),
    {
      name: "debug-mode-storage",
      storage: createJSONStorage(() => syncStorage),
    }
  )
);
