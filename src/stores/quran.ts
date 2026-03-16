import { create } from "zustand";
import Storage from "expo-sqlite/kv-store";
import { createJSONStorage, persist } from "zustand/middleware";

import { DEFAULT_MUSHAF_VERSION, DEFAULT_QURAN_THEME } from "@/constants/Quran";
import { DownloadStatus, MushafVersion } from "@/enums/quran";
import { QuranState, VersionDownloadState } from "@/types/quran";

export const useQuranStore = create<QuranState>()(
  persist(
    (set, get) => ({
      currentPage: 1,
      currentVersion: DEFAULT_MUSHAF_VERSION,
      quranTheme: DEFAULT_QURAN_THEME,
      lastReadPage: 1,

      onboardingComplete: false,
      selectedVersion: null,
      versionDownloads: {},

      setCurrentPage: (page) => set({ currentPage: page, lastReadPage: page }),
      setCurrentVersion: (version) => set({ currentVersion: version }),
      setQuranTheme: (theme) => set({ quranTheme: theme }),

      setOnboardingComplete: () => set({ onboardingComplete: true }),
      setSelectedVersion: (version) => set({ selectedVersion: version, currentVersion: version }),
      updateDownloadState: (version, state) =>
        set((prev) => ({
          versionDownloads: {
            ...prev.versionDownloads,
            [version]: {
              status: state.status ?? prev.versionDownloads[version]?.status ?? DownloadStatus.IDLE,
              progress:
                state.progress !== undefined
                  ? state.progress
                  : (prev.versionDownloads[version]?.progress ?? null),
            },
          },
        })),
      isVersionComplete: (version) =>
        get().versionDownloads[version]?.status === DownloadStatus.COMPLETE,
    }),
    {
      name: "quran-storage",
      storage: createJSONStorage(() => Storage),
      partialize: (state) => ({
        currentPage: state.currentPage,
        currentVersion: state.currentVersion,
        quranTheme: state.quranTheme,
        lastReadPage: state.lastReadPage,
        onboardingComplete: state.onboardingComplete,
        selectedVersion: state.selectedVersion,
        versionDownloads: Object.fromEntries(
          Object.entries(state.versionDownloads).map(([k, v]) => [
            k,
            {
              status: v?.status ?? DownloadStatus.IDLE,
              progress: null,
            } satisfies VersionDownloadState,
          ])
        ) as Partial<Record<MushafVersion, VersionDownloadState>>,
      }),
    }
  )
);
