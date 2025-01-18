import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { createJSONStorage, devtools, persist } from "zustand/middleware";
import { getLocales } from "expo-localization";

// Enums
import { AppLocale } from "@/enums/app";

type AppState = {
  isFirstRun: boolean;
  language: AppLocale;
  setIsFirstRun: (status: boolean) => void;
  setLanguage: (lang: AppLocale) => void;
};

const getInitialLanguage = (): AppLocale => {
  // Get device language (first two characters "en")
  const deviceLanguage = getLocales()[0]

    ?.languageCode?.toLowerCase()
    .slice(0, 2);

  // Check if device language is supported in our AppLocale enum
  const isSupported = Object.values(AppLocale).includes(
    deviceLanguage as AppLocale
  );

  // Return device language if supported, otherwise default to EN
  return isSupported ? (deviceLanguage as AppLocale) : AppLocale.EN;
};

const initialLanguage = getInitialLanguage();

export const useAppStore = create<AppState>()(
  devtools(
    persist(
      (set) => ({
        isFirstRun: true,
        language: initialLanguage,

        setIsFirstRun(isFirstRun: boolean) {
          set({ isFirstRun });
        },

        setLanguage: async (language: AppLocale) => {
          set({ language });
        },
      }),
      {
        name: "app-storage",
        storage: createJSONStorage(() => AsyncStorage),
      }
    )
  )
);
