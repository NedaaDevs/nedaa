import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { createJSONStorage, devtools, persist } from "zustand/middleware";
import { getLocales } from "expo-localization";

// Enums
import { AppLanguage } from "@/enums/app";

type AppState = {
  isFirstRun: boolean;
  language: AppLanguage;
  setIsFirstRun: (status: boolean) => void;
  setLanguage: (lang: AppLanguage) => void;
};

const getInitialLanguage = (): AppLanguage => {
  // Get device language (first two characters "en")
  const deviceLanguage = getLocales()[0]

    ?.languageCode?.toLowerCase()
    .slice(0, 2);

  // Check if device language is supported in our AppLanguage enum
  const isSupported = Object.values(AppLanguage).includes(
    deviceLanguage as AppLanguage
  );

  // Return device language if supported, otherwise default to EN
  return isSupported ? (deviceLanguage as AppLanguage) : AppLanguage.EN;
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

        setLanguage: async (language: AppLanguage) => {
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
