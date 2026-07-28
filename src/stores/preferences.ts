import { create } from "zustand";
import Storage from "expo-sqlite/kv-store";
import { createJSONStorage, persist } from "zustand/middleware";
import { getLocales } from "expo-localization";

// Seeds the initial 24-hour setting from the device clock; once the user
// touches the toggle the persisted value takes over.
const deviceUses24HourClock = (): boolean => getLocales()[0]?.uses24hourClock ?? false;

type PreferencesState = {
  useWesternNumerals: boolean;
  // Clock format for prayer and adhan times. Seeded from the device on first run.
  use24HourTime: boolean;
  countdownEnabled: boolean;
  countdownMinutes: number;
  iqamaCountUpEnabled: boolean;
  iqamaCountUpMinutes: number;
  hapticsEnabled: boolean;
  // Home shows the Important Days pager card. The Tools screen is always available.
  showImportantDaysOnHome: boolean;
  // Accessibility: render bigger buttons/text where controls support it (default off).
  largeControls: boolean;
  // Send anonymous play stats to the API (default on). Gates trackPlay().
  shareUsageStats: boolean;

  setUseWesternNumerals: (value: boolean) => void;
  setUse24HourTime: (value: boolean) => void;
  setCountdownEnabled: (value: boolean) => void;
  setCountdownMinutes: (value: number) => void;
  setIqamaCountUpEnabled: (value: boolean) => void;
  setIqamaCountUpMinutes: (value: number) => void;
  setHapticsEnabled: (value: boolean) => void;
  setShowImportantDaysOnHome: (value: boolean) => void;
  setLargeControls: (value: boolean) => void;
  setShareUsageStats: (value: boolean) => void;
};

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      useWesternNumerals: false,
      use24HourTime: deviceUses24HourClock(),
      countdownEnabled: false,
      countdownMinutes: 60,
      iqamaCountUpEnabled: false,
      iqamaCountUpMinutes: 30,
      hapticsEnabled: true,
      showImportantDaysOnHome: false,
      largeControls: false,
      shareUsageStats: true,

      setUseWesternNumerals: (value) => set({ useWesternNumerals: value }),
      setUse24HourTime: (value) => set({ use24HourTime: value }),
      setCountdownEnabled: (value) => set({ countdownEnabled: value }),
      setCountdownMinutes: (value) => set({ countdownMinutes: value }),
      setIqamaCountUpEnabled: (value) => set({ iqamaCountUpEnabled: value }),
      setIqamaCountUpMinutes: (value) => set({ iqamaCountUpMinutes: value }),
      setHapticsEnabled: (value) => set({ hapticsEnabled: value }),
      setShowImportantDaysOnHome: (value) => set({ showImportantDaysOnHome: value }),
      setLargeControls: (value) => set({ largeControls: value }),
      setShareUsageStats: (value) => set({ shareUsageStats: value }),
    }),
    {
      name: "display-storage",
      storage: createJSONStorage(() => Storage),
    }
  )
);

export default usePreferencesStore;
