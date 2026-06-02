import { useColorScheme } from "react-native";

import { DownloadStatus, QuranTheme } from "@/enums/quran";
import { isColoredVersion, isDarkPaper } from "@/constants/Quran";
import { useAppStore } from "@/stores/app";
import { useQuranStore } from "@/stores/quran";

// Resolves the effective Quran reader theme:
// - When the user has explicitly picked one (`quranThemeOverride === true`),
//   returns that choice.
// - Otherwise follows the app's color scheme (light → SEPIA, dark → DARK),
//   honoring `useAppStore.mode` of "system" | "light" | "dark".
// - A colored edition (V4) renders a dark paper (DARK/AMOLED) from its own dark
//   page bundle; without it installed, coloured pages on black are unreadable,
//   so the resolved theme falls back to SEPIA until it is.
export const useResolvedQuranTheme = (): QuranTheme => {
  const quranTheme = useQuranStore((s) => s.quranTheme);
  const override = useQuranStore((s) => s.quranThemeOverride);
  const currentVersion = useQuranStore((s) => s.currentVersion);
  const darkInstalled = useQuranStore(
    (s) => s.versionDownloads[s.currentVersion]?.dark?.status === DownloadStatus.COMPLETE
  );
  const mode = useAppStore((s) => s.mode);
  const systemScheme = useColorScheme();

  const appIsDark = mode === "system" ? systemScheme === "dark" : mode === "dark";
  const resolved = override ? quranTheme : appIsDark ? QuranTheme.DARK : QuranTheme.SEPIA;

  if (isDarkPaper(resolved) && isColoredVersion(currentVersion) && !darkInstalled) {
    return QuranTheme.SEPIA;
  }
  return resolved;
};

// The user's effective dark preference *before* the colored-edition fallback —
// i.e. "they want a dark reader." Used to decide whether to offer the V4 dark
// page bundle (the resolved theme alone can't tell, since it falls back).
export const usePrefersDarkReader = (): boolean => {
  const override = useQuranStore((s) => s.quranThemeOverride);
  const quranTheme = useQuranStore((s) => s.quranTheme);
  const mode = useAppStore((s) => s.mode);
  const systemScheme = useColorScheme();

  const appIsDark = mode === "system" ? systemScheme === "dark" : mode === "dark";
  return override ? isDarkPaper(quranTheme) : appIsDark;
};
