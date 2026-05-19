import { useColorScheme } from "react-native";

import { QuranTheme } from "@/enums/quran";
import { useAppStore } from "@/stores/app";
import { useQuranStore } from "@/stores/quran";

// Resolves the effective Quran reader theme:
// - When the user has explicitly picked one (`quranThemeOverride === true`),
//   returns that choice.
// - Otherwise follows the app's color scheme (light → SEPIA, dark → DARK),
//   honoring `useAppStore.mode` of "system" | "light" | "dark".
export function useResolvedQuranTheme(): QuranTheme {
  const quranTheme = useQuranStore((s) => s.quranTheme);
  const override = useQuranStore((s) => s.quranThemeOverride);
  const mode = useAppStore((s) => s.mode);
  const systemScheme = useColorScheme();

  if (override) return quranTheme;

  const appIsDark = mode === "system" ? systemScheme === "dark" : mode === "dark";
  return appIsDark ? QuranTheme.DARK : QuranTheme.SEPIA;
}
