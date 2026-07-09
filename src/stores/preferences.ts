import { create } from "zustand";
import Storage from "expo-sqlite/kv-store";
import { createJSONStorage, persist } from "zustand/middleware";

type PreferencesState = {
  useWesternNumerals: boolean;
  countdownEnabled: boolean;
  countdownMinutes: number;
  iqamaCountUpEnabled: boolean;
  iqamaCountUpMinutes: number;
  hapticsEnabled: boolean;
  // Home shows the Important Days pager card. The Tools screen is always available.
  showImportantDaysOnHome: boolean;
  // Accessibility: render bigger buttons/text where controls support it (default off).
  largeControls: boolean;

  setUseWesternNumerals: (value: boolean) => void;
  setCountdownEnabled: (value: boolean) => void;
  setCountdownMinutes: (value: number) => void;
  setIqamaCountUpEnabled: (value: boolean) => void;
  setIqamaCountUpMinutes: (value: number) => void;
  setHapticsEnabled: (value: boolean) => void;
  setShowImportantDaysOnHome: (value: boolean) => void;
  setLargeControls: (value: boolean) => void;
};

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      useWesternNumerals: false,
      countdownEnabled: false,
      countdownMinutes: 60,
      iqamaCountUpEnabled: false,
      iqamaCountUpMinutes: 30,
      hapticsEnabled: true,
      showImportantDaysOnHome: false,
      largeControls: false,

      setUseWesternNumerals: (value) => set({ useWesternNumerals: value }),
      setCountdownEnabled: (value) => set({ countdownEnabled: value }),
      setCountdownMinutes: (value) => set({ countdownMinutes: value }),
      setIqamaCountUpEnabled: (value) => set({ iqamaCountUpEnabled: value }),
      setIqamaCountUpMinutes: (value) => set({ iqamaCountUpMinutes: value }),
      setHapticsEnabled: (value) => set({ hapticsEnabled: value }),
      setShowImportantDaysOnHome: (value) => set({ showImportantDaysOnHome: value }),
      setLargeControls: (value) => set({ largeControls: value }),
    }),
    {
      name: "display-storage",
      storage: createJSONStorage(() => Storage),
    }
  )
);

export default usePreferencesStore;
