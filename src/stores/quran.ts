import { create } from "zustand";
import Storage from "expo-sqlite/kv-store";
import { createJSONStorage, persist } from "zustand/middleware";

import {
  DEFAULT_MUSHAF_VERSION,
  DEFAULT_QURAN_THEME,
  DEFAULT_SURAH_FRAME_STYLE,
  DEFAULT_QURAN_FONT,
  FONT_SIZE_DEFAULT,
  FONT_SIZE_MIN,
  FONT_SIZE_MAX,
} from "@/constants/Quran";
import {
  DownloadStatus,
  MushafVersion,
  QuranFont,
  QuranTheme,
  ReaderViewMode,
} from "@/enums/quran";
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
      textFont: DEFAULT_QURAN_FONT,
      showHeaderOrnament: false,
      libraryTab: "index",

      onboardingComplete: false,
      selectedVersion: null,
      versionDownloads: {},
      darkOfferDismissed: {},

      // Transient: true only while the immersive reader is the visible surface
      // (not the version-picker / download chrome). Lets the app shell paint the
      // status-bar safe area with the reader theme for the reader, app theme for
      // chrome. Not persisted.
      readerActive: false,

      setReaderActive: (active) => set({ readerActive: active }),
      setCurrentPage: (page) => set({ currentPage: page, lastReadPage: page }),
      setCurrentVersion: (version) => set({ currentVersion: version }),
      setQuranTheme: (theme) => set({ quranTheme: theme, quranThemeOverride: true }),
      setQuranThemeAuto: () => set({ quranThemeOverride: false }),
      setSurahFrameStyle: (style) => set({ surahFrameStyle: style }),
      setReaderMode: (mode: ReaderViewMode) => set({ readerMode: mode }),
      setFontSize: (size: number) =>
        set({ fontSize: Math.max(FONT_SIZE_MIN, Math.min(FONT_SIZE_MAX, size)) }),
      setTextFont: (font: QuranFont) => set({ textFont: font }),
      setShowHeaderOrnament: (show: boolean) => set({ showHeaderOrnament: show }),
      setLibraryTab: (tab) => set({ libraryTab: tab }),

      setOnboardingComplete: () => set({ onboardingComplete: true }),
      setSelectedVersion: (version) => set({ selectedVersion: version, currentVersion: version }),
      updateDownloadState: (version, state) =>
        set((prev) => ({
          versionDownloads: {
            ...prev.versionDownloads,
            [version]: {
              // Spread the previous entry so the independent `dark` sub-state
              // survives light-bundle status changes.
              ...prev.versionDownloads[version],
              status: state.status ?? prev.versionDownloads[version]?.status ?? DownloadStatus.IDLE,
              progress:
                state.progress !== undefined
                  ? state.progress
                  : (prev.versionDownloads[version]?.progress ?? null),
            },
          },
        })),
      updateDarkDownloadState: (version, state) =>
        set((prev) => {
          const current = prev.versionDownloads[version] ?? {
            status: DownloadStatus.IDLE,
            progress: null,
          };
          const prevDark = current.dark;
          return {
            versionDownloads: {
              ...prev.versionDownloads,
              [version]: {
                ...current,
                dark: {
                  status: state.status ?? prevDark?.status ?? DownloadStatus.IDLE,
                  progress:
                    state.progress !== undefined ? state.progress : (prevDark?.progress ?? null),
                },
              },
            },
          };
        }),
      removeDark: (version) =>
        set((prev) => {
          const current = prev.versionDownloads[version];
          if (!current?.dark) return {};
          const { dark: _dark, ...rest } = current;
          return { versionDownloads: { ...prev.versionDownloads, [version]: rest } };
        }),
      removeVersion: (version) =>
        set((prev) => {
          // Drop the key entirely — an IDLE entry would leave the version
          // visible in download listings as if it were still installable in
          // place, which is the bug this action fixes.
          const { [version]: _removed, ...remainingDownloads } = prev.versionDownloads;
          const remainingComplete = Object.entries(remainingDownloads).filter(
            ([, v]) => (v as VersionDownloadState | undefined)?.status === DownloadStatus.COMPLETE
          );
          const hasRemainingComplete = remainingComplete.length > 0;
          return {
            versionDownloads: remainingDownloads,
            selectedVersion: prev.selectedVersion === version ? null : prev.selectedVersion,
            // If the reader was on the deleted version, fall back to any other
            // complete one (so the reader keeps working) or to the default
            // sentinel (which the version picker will overwrite anyway).
            currentVersion:
              prev.currentVersion === version
                ? hasRemainingComplete
                  ? (remainingComplete[0][0] as MushafVersion)
                  : DEFAULT_MUSHAF_VERSION
                : prev.currentVersion,
            // No complete versions left → send the user back to the picker
            // on next mount of the Quran tab.
            onboardingComplete: hasRemainingComplete ? prev.onboardingComplete : false,
          };
        }),
      isVersionComplete: (version) =>
        get().versionDownloads[version]?.status === DownloadStatus.COMPLETE,
      isDarkComplete: (version) =>
        get().versionDownloads[version]?.dark?.status === DownloadStatus.COMPLETE,
      dismissDarkOffer: (version) =>
        set((prev) => ({
          darkOfferDismissed: { ...prev.darkOfferDismissed, [version]: true },
        })),
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
        textFont: state.textFont,
        showHeaderOrnament: state.showHeaderOrnament,
        libraryTab: state.libraryTab,
        onboardingComplete: state.onboardingComplete,
        selectedVersion: state.selectedVersion,
        darkOfferDismissed: state.darkOfferDismissed,
        versionDownloads: Object.fromEntries(
          Object.entries(state.versionDownloads).map(([k, v]) => [
            k,
            {
              status: v?.status ?? DownloadStatus.IDLE,
              progress: null,
              ...(v?.dark ? { dark: { status: v.dark.status, progress: null } } : {}),
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
        const validFonts = Object.values(QuranFont) as string[];
        if (!validFonts.includes(merged.textFont)) {
          merged.textFont = DEFAULT_QURAN_FONT;
        }
        // A DOWNLOADING/PAUSED status can't survive a process restart — the
        // in-flight transfer is gone. Reset to IDLE on load so the app never
        // reopens trapped on a frozen download screen; the router then shows
        // the version picker for any non-complete version.
        if (merged.versionDownloads) {
          const resetStatus = (s: DownloadStatus | undefined) => {
            const status = s ?? DownloadStatus.IDLE;
            return status === DownloadStatus.DOWNLOADING || status === DownloadStatus.PAUSED
              ? DownloadStatus.IDLE
              : status;
          };
          merged.versionDownloads = Object.fromEntries(
            Object.entries(merged.versionDownloads).map(([k, v]) => {
              const vs = v as VersionDownloadState | undefined;
              const entry: VersionDownloadState = {
                status: resetStatus(vs?.status),
                progress: null,
              };
              if (vs?.dark) {
                entry.dark = { status: resetStatus(vs.dark.status), progress: null };
              }
              return [k, entry];
            })
          ) as Partial<Record<MushafVersion, VersionDownloadState>>;
        }
        return merged;
      },
    }
  )
);
