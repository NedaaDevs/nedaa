import { QuranTheme, QuranThemeType, MushafVersion } from "@/enums/quran";
import { isDarkPaper, isColoredVersion } from "@/constants/Quran";

// Effective reader theme. With no override the reader follows the app's light/
// dark scheme onto the Nedaa brand paper. A colored (V4) edition on dark paper
// without its dark bundle falls back to Sepia so the tajweed colours stay legible.
export const resolveQuranTheme = (args: {
  override: boolean;
  theme: QuranThemeType;
  appIsDark: boolean;
  version: MushafVersion;
  darkInstalled: boolean;
}): QuranThemeType => {
  const { override, theme, appIsDark, version, darkInstalled } = args;
  const resolved = override ? theme : appIsDark ? QuranTheme.NEDAA_DARK : QuranTheme.NEDAA_LIGHT;
  if (isDarkPaper(resolved) && isColoredVersion(version) && !darkInstalled) {
    return QuranTheme.SEPIA;
  }
  return resolved;
};
