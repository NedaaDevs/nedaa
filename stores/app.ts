import { Appearance } from "react-native";
import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { createJSONStorage, devtools, persist } from "zustand/middleware";
import { getLocales } from "expo-localization";

// Enums
import { AppLocale, AppDirection, AppMode } from "@/enums/app";

// Constants
import { RTL_LOCALES } from "@/constants/Locales";

import i18n from "@/localization/i18n";

export type AppState = {
  isFirstRun: boolean;
  locale: AppLocale;
  direction: AppDirection;
  mode: AppMode;
  setIsFirstRun: (status: boolean) => void;
  setLocale: (lang: AppLocale) => void;
  setMode: (mode: AppMode) => void;
};

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
    persist(
      (set) => ({
        isFirstRun: true,
        locale: initialLanguage,
        mode: Appearance.getColorScheme() as AppMode,
        direction: initialDirection,

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
      }),
      {
        name: "app-storage",
        storage: createJSONStorage(() => AsyncStorage),
        onRehydrateStorage: () => (state) => {
          if (state?.locale) {
            i18n.changeLanguage(state.locale);
          }
        },
      },
    ),
  ),
);
