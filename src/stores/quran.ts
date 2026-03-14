import { create } from "zustand";
import Storage from "expo-sqlite/kv-store";
import { createJSONStorage, persist } from "zustand/middleware";

import { DEFAULT_MUSHAF_VERSION, DEFAULT_QURAN_THEME } from "@/constants/Quran";
import { QuranState } from "@/types/quran";

export const useQuranStore = create<QuranState>()(
  persist(
    (set) => ({
      currentPage: 1,
      currentVersion: DEFAULT_MUSHAF_VERSION,
      quranTheme: DEFAULT_QURAN_THEME,
      lastReadPage: 1,

      setCurrentPage: (page) => set({ currentPage: page, lastReadPage: page }),
      setCurrentVersion: (version) => set({ currentVersion: version }),
      setQuranTheme: (theme) => set({ quranTheme: theme }),
    }),
    {
      name: "quran-storage",
      storage: createJSONStorage(() => Storage),
    }
  )
);
