import { create } from "zustand";
import Storage from "expo-sqlite/kv-store";
import { createJSONStorage, persist } from "zustand/middleware";

import {
  DEFAULT_MUSHAF_VERSION,
  DEFAULT_QURAN_THEME,
  DEFAULT_SURAH_FRAME_STYLE,
  FONT_SIZE_DEFAULT,
  FONT_SIZE_MIN,
  FONT_SIZE_MAX,
} from "@/constants/Quran";
import { DownloadStatus, MushafVersion, QuranTheme, ReaderViewMode } from "@/enums/quran";
import { QuranState, VersionDownloadState } from "@/types/quran";

export const useQuranStore = create<QuranState>()(
  persist(
    (set, get) => ({
      currentPage: 1,
      currentVersion: DEFAULT_MUSHAF_VERSION,
      quranTheme: DEFAULT_QURAN_THEME,
      quranThemeOverride: false,
      surahFrameStyle: DEFAULT_SURAH_FRAME_STYLE,
      lastReadPage: 1,
      readerMode: ReaderViewMode.MADINAH,
      fontSize: FONT_SIZE_DEFAULT,

      onboardingComplete: false,
      selectedVersion: null,
      versionDownloads: {},

      setCurrentPage: (page) => set({ currentPage: page, lastReadPage: page }),
      setCurrentVersion: (version) => set({ currentVersion: version }),
      setQuranTheme: (theme) => set({ quranTheme: theme, quranThemeOverride: true }),
      setQuranThemeAuto: () => set({ quranThemeOverride: false }),
      setSurahFrameStyle: (style) => set({ surahFrameStyle: style }),
      setReaderMode: (mode: ReaderViewMode) => set({ readerMode: mode }),
      setFontSize: (size: number) =>
        set({ fontSize: Math.max(FONT_SIZE_MIN, Math.min(FONT_SIZE_MAX, size)) }),

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
        quranThemeOverride: state.quranThemeOverride,
        surahFrameStyle: state.surahFrameStyle,
        lastReadPage: state.lastReadPage,
        readerMode: state.readerMode,
        fontSize: state.fontSize,
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
      merge: (persisted, current) => {
        const merged = { ...current, ...(persisted as object) };
        const validThemes = Object.values(QuranTheme) as string[];
        if (!validThemes.includes(merged.quranTheme)) {
          merged.quranTheme = DEFAULT_QURAN_THEME;
        }
        const validModes = Object.values(ReaderViewMode) as string[];
        if (!validModes.includes(merged.readerMode)) {
          merged.readerMode = ReaderViewMode.MADINAH;
        }
        if (
          typeof merged.fontSize !== "number" ||
          merged.fontSize < FONT_SIZE_MIN ||
          merged.fontSize > FONT_SIZE_MAX
        ) {
          merged.fontSize = FONT_SIZE_DEFAULT;
        }
        return merged;
      },
    }
  )
);
