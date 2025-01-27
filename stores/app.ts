import { Appearance } from "react-native";
import { create } from "zustand";
import Storage from "expo-sqlite/kv-store";

import {
  createJSONStorage,
  devtools,
  persist,
  subscribeWithSelector,
} from "zustand/middleware";
import { getLocales } from "expo-localization";

import i18n from "@/localization/i18n";

// Enums
import { AppLocale, AppDirection, AppMode } from "@/enums/app";

// Constants
import { RTL_LOCALES } from "@/constants/Locales";

// Types
import { AppState } from "@/types/app";

const getInitialLanguage = (): AppLocale => {
  // Get device locale (first two characters "en")
  const deviceLanguage = getLocales()[0]
    ?.languageCode?.toLowerCase()
    .slice(0, 2);

  // Check if device locale is supported in our AppLocale enum
  const isSupported = Object.values(AppLocale).includes(
    deviceLanguage as AppLocale,
  );

  // Return device locale if supported, otherwise default to EN
  return isSupported ? (deviceLanguage as AppLocale) : AppLocale.EN;
};

export const getDirection = (locale: AppLocale): AppDirection => {
  return RTL_LOCALES.includes(locale as (typeof RTL_LOCALES)[number])
    ? AppDirection.RTL
    : AppDirection.LTR;
};

export const isRTL = (direction: AppDirection) =>
  direction === AppDirection.RTL;

const initialLanguage = getInitialLanguage();
const initialDirection = getDirection(initialLanguage);

export const useAppStore = create<AppState>()(
  devtools(
    subscribeWithSelector(
      persist(
        (set) => ({
          isFirstRun: true,
          locale: initialLanguage,
          mode: Appearance.getColorScheme() as AppMode,
          direction: initialDirection,
          sendCrashLogs: true,

          setIsFirstRun(isFirstRun: boolean) {
            set({ isFirstRun });
          },

          setLocale: (locale: AppLocale) => {
            i18n.changeLanguage(locale);
            set({ locale });
          },

          setMode: (mode: AppMode) => {
            set({ mode });
          },

          setSendCrashLogs: (sendCrashLogs: boolean) => {
            set({ sendCrashLogs });
          },
        }),
        {
          name: "app-storage",
          storage: createJSONStorage(() => Storage),
          onRehydrateStorage: () => (state) => {
            if (state?.locale) {
              i18n.changeLanguage(state.locale);
            }
          },
        },
      ),
    ),
  ),
);
