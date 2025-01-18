import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { createJSONStorage, devtools, persist } from "zustand/middleware";
import { getLocales } from "expo-localization";

// Enums
import { AppLocale } from "@/enums/app";

type AppState = {
  isFirstRun: boolean;
  locale: AppLocale;
  setIsFirstRun: (status: boolean) => void;
  setLocale: (lang: AppLocale) => void;
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

const initialLanguage = getInitialLanguage();

export const useAppStore = create<AppState>()(
  devtools(
    persist(
      (set) => ({
        isFirstRun: true,
        locale: initialLanguage,

        setIsFirstRun(isFirstRun: boolean) {
          set({ isFirstRun });
        },

        setLocale: async (locale: AppLocale) => {
          set({ locale });
        },
      }),
      {
        name: "app-storage",
        storage: createJSONStorage(() => AsyncStorage),
      }
    )
  )
);
