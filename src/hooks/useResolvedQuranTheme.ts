import { useColorScheme } from "react-native";

import { DownloadStatus, QuranThemeType } from "@/enums/quran";
import { isDarkPaper } from "@/constants/Quran";
import { useAppStore } from "@/stores/app";
import { useQuranStore } from "@/stores/quran";
import { resolveQuranTheme } from "@/utils/quranTheme";

const useAppIsDark = (): boolean => {
  const mode = useAppStore((s) => s.mode);
  const systemScheme = useColorScheme();
  return mode === "system" ? systemScheme === "dark" : mode === "dark";
};

// Effective reader theme: no override → Nedaa brand paper following the app
// scheme; otherwise the picked theme. The colored-edition dark fallback lives in
// resolveQuranTheme.
export const useResolvedQuranTheme = (): QuranThemeType => {
  const quranTheme = useQuranStore((s) => s.quranTheme);
  const override = useQuranStore((s) => s.quranThemeOverride);
  const currentVersion = useQuranStore((s) => s.currentVersion);
  const darkInstalled = useQuranStore(
    (s) => s.versionDownloads[s.currentVersion]?.dark?.status === DownloadStatus.COMPLETE
  );
  const appIsDark = useAppIsDark();
  return resolveQuranTheme({
    override,
    theme: quranTheme,
    appIsDark,
    version: currentVersion,
    darkInstalled,
  });
};

// Quran theme for verse previews OUTSIDE the reader (library, index): follows the
// app scheme onto the Nedaa paper, ignoring the in-reader override so a reader
// choice doesn't bleed onto app-themed surfaces.
export const usePreviewQuranTheme = (): QuranThemeType => {
  const quranTheme = useQuranStore((s) => s.quranTheme);
  const currentVersion = useQuranStore((s) => s.currentVersion);
  const darkInstalled = useQuranStore(
    (s) => s.versionDownloads[s.currentVersion]?.dark?.status === DownloadStatus.COMPLETE
  );
  const appIsDark = useAppIsDark();
  return resolveQuranTheme({
    override: false,
    theme: quranTheme,
    appIsDark,
    version: currentVersion,
    darkInstalled,
  });
};

// The user's effective dark preference *before* the colored-edition fallback —
// i.e. "they want a dark reader." Used to decide whether to offer the V4 dark
// page bundle (the resolved theme alone can't tell, since it falls back).
export const usePrefersDarkReader = (): boolean => {
  const override = useQuranStore((s) => s.quranThemeOverride);
  const quranTheme = useQuranStore((s) => s.quranTheme);
  const appIsDark = useAppIsDark();
  return override ? isDarkPaper(quranTheme) : appIsDark;
};
