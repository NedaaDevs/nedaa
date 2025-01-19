import { Appearance } from "react-native";
import { I18nManager } from "react-native";
import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Updates from "expo-updates";

import { createJSONStorage, devtools, persist } from "zustand/middleware";
import { getLocales } from "expo-localization";

// Enums
import { AppLocale, AppDirection, AppMode } from "@/enums/app";

// Constants
import { RTL_LOCALES } from "@/constants/Locales";

type AppState = {
  isFirstRun: boolean;
  locale: AppLocale;
  direction: AppDirection;
  mode: AppMode;
  setIsFirstRun: (status: boolean) => void;
  setLocale: (lang: AppLocale) => void;
  setDirection: (direction: AppDirection) => Promise<void>;
  setMode: (mode: AppMode) => void;
};

const getInitialLanguage = (): AppLocale => {
  // Get device locale (first two characters "en")
  const deviceLanguage = getLocales()[0]

    ?.languageCode?.toLowerCase()
    .slice(0, 2);

  // Check if device locale is supported in our AppLocale enum
  const isSupported = Object.values(AppLocale).includes(
    deviceLanguage as AppLocale
  );

  // Return device locale if supported, otherwise default to EN
  return isSupported ? (deviceLanguage as AppLocale) : AppLocale.EN;
};

const getDirection = (locale: AppLocale): AppDirection => {
  return RTL_LOCALES.includes(locale as (typeof RTL_LOCALES)[number])
    ? AppDirection.RTL
    : AppDirection.LTR;
};

const isRTL = (direction: AppDirection) => direction === AppDirection.RTL;

const initialLanguage = getInitialLanguage();
const initialDirection = getDirection(initialLanguage);

export const useAppStore = create<AppState>()(
  devtools(
    persist(
      (set, get) => ({
        isFirstRun: true,
        locale: initialLanguage,
        mode: Appearance.getColorScheme() as AppMode,
        direction: initialDirection,

        setIsFirstRun(isFirstRun: boolean) {
          set({ isFirstRun });
        },

        setLocale: (locale: AppLocale) => {
          set({ locale });
          get().setDirection(getDirection(locale));
        },

        setDirection: async (direction) => {
          const isRtl = isRTL(direction);
          if (isRtl !== I18nManager.isRTL) {
            set({ direction });
            I18nManager.allowRTL(isRtl);
            I18nManager.forceRTL(isRtl);
            try {
              await Updates.reloadAsync();
            } catch (error) {
              console.error("Failed to reload app after RTL change:", error);
            }
          }
        },

        setMode: (mode: AppMode) => {
          set({ mode });
        },
      }),
      {
        name: "app-storage",
        storage: createJSONStorage(() => AsyncStorage),
      }
    )
  )
);
