import { create } from "zustand";
import Storage from "expo-sqlite/kv-store";
import { createJSONStorage, persist } from "zustand/middleware";
import { getCalendars } from "expo-localization";
import { OpeningTab, type OpeningTabValue, TextSize, type TextSizeValue } from "@/enums/app";

// Seeds the initial 24-hour setting from the device clock; once the user
// touches the toggle the persisted value takes over.
const deviceUses24HourClock = (): boolean => getCalendars()[0]?.uses24hourClock ?? false;

// expo-localization numbers weekdays 1-7 from Sunday; Date.getDay() numbers
// them 0-6. The store keeps the getDay() convention so callers need not convert.
const deviceWeekStartsOn = (): number => (getCalendars()[0]?.firstWeekday ?? 1) - 1;

type PreferencesState = {
  useWesternNumerals: boolean;
  // Clock format for prayer and adhan times. Seeded from the device on first run.
  use24HourTime: boolean;
  // First column of the Hijri calendar grid. Seeded from the device on first run.
  weekStartsOn: number;
  // Tab the app lands on at launch.
  openingTab: OpeningTabValue;
  countdownEnabled: boolean;
  countdownMinutes: number;
  iqamaCountUpEnabled: boolean;
  iqamaCountUpMinutes: number;
  hapticsEnabled: boolean;
  // Home shows the Important Days pager card. The Tools screen is always available.
  showImportantDaysOnHome: boolean;
  // Accessibility: render bigger buttons/text where controls support it (default off).
  largeControls: boolean;
  // In-app text size preset. Applied by the shared Text primitive; the OS
  // font scale never scales app text.
  textSize: TextSizeValue;
  // The text-size offer was answered (onboarding, What's New, or Settings).
  textSizeOfferHandled: boolean;
  // Send anonymous play stats to the API (default on). Gates trackPlay().
  shareUsageStats: boolean;

  setUseWesternNumerals: (value: boolean) => void;
  setUse24HourTime: (value: boolean) => void;
  setWeekStartsOn: (value: number) => void;
  setOpeningTab: (value: OpeningTabValue) => void;
  setCountdownEnabled: (value: boolean) => void;
  setCountdownMinutes: (value: number) => void;
  setIqamaCountUpEnabled: (value: boolean) => void;
  setIqamaCountUpMinutes: (value: number) => void;
  setHapticsEnabled: (value: boolean) => void;
  setShowImportantDaysOnHome: (value: boolean) => void;
  setLargeControls: (value: boolean) => void;
  setShareUsageStats: (value: boolean) => void;
  setTextSize: (value: TextSizeValue) => void;
  markTextSizeOfferHandled: () => void;
};

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      useWesternNumerals: false,
      use24HourTime: deviceUses24HourClock(),
      weekStartsOn: deviceWeekStartsOn(),
      openingTab: OpeningTab.HOME,
      countdownEnabled: false,
      countdownMinutes: 60,
      iqamaCountUpEnabled: false,
      iqamaCountUpMinutes: 30,
      hapticsEnabled: true,
      showImportantDaysOnHome: false,
      largeControls: false,
      shareUsageStats: true,
      textSize: TextSize.DEFAULT,
      textSizeOfferHandled: false,

      setUseWesternNumerals: (value) => set({ useWesternNumerals: value }),
      setUse24HourTime: (value) => set({ use24HourTime: value }),
      setWeekStartsOn: (value) => set({ weekStartsOn: value }),
      setOpeningTab: (value) => set({ openingTab: value }),
      setCountdownEnabled: (value) => set({ countdownEnabled: value }),
      setCountdownMinutes: (value) => set({ countdownMinutes: value }),
      setIqamaCountUpEnabled: (value) => set({ iqamaCountUpEnabled: value }),
      setIqamaCountUpMinutes: (value) => set({ iqamaCountUpMinutes: value }),
      setHapticsEnabled: (value) => set({ hapticsEnabled: value }),
      setShowImportantDaysOnHome: (value) => set({ showImportantDaysOnHome: value }),
      setLargeControls: (value) => set({ largeControls: value }),
      setShareUsageStats: (value) => set({ shareUsageStats: value }),
      setTextSize: (value) => set({ textSize: value, textSizeOfferHandled: true }),
      markTextSizeOfferHandled: () => set({ textSizeOfferHandled: true }),
    }),
    {
      name: "display-storage",
      storage: createJSONStorage(() => Storage),
    }
  )
);

export default usePreferencesStore;
