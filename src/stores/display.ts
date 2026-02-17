import { create } from "zustand";
import Storage from "expo-sqlite/kv-store";
import { createJSONStorage, persist } from "zustand/middleware";

type DisplayState = {
  useWesternNumerals: boolean;
  countdownEnabled: boolean;
  countdownMinutes: number;
  iqamaCountUpEnabled: boolean;
  iqamaCountUpMinutes: number;

  setUseWesternNumerals: (value: boolean) => void;
  setCountdownEnabled: (value: boolean) => void;
  setCountdownMinutes: (value: number) => void;
  setIqamaCountUpEnabled: (value: boolean) => void;
  setIqamaCountUpMinutes: (value: number) => void;
};

export const useDisplayStore = create<DisplayState>()(
  persist(
    (set) => ({
      useWesternNumerals: false,
      countdownEnabled: false,
      countdownMinutes: 60,
      iqamaCountUpEnabled: false,
      iqamaCountUpMinutes: 30,

      setUseWesternNumerals: (value) => set({ useWesternNumerals: value }),
      setCountdownEnabled: (value) => set({ countdownEnabled: value }),
      setCountdownMinutes: (value) => set({ countdownMinutes: value }),
      setIqamaCountUpEnabled: (value) => set({ iqamaCountUpEnabled: value }),
      setIqamaCountUpMinutes: (value) => set({ iqamaCountUpMinutes: value }),
    }),
    {
      name: "display-storage",
      storage: createJSONStorage(() => Storage),
    }
  )
);

export default useDisplayStore;
