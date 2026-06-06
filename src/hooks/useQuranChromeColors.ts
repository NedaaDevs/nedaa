import { useTheme } from "tamagui";

// The Quran "chrome" (version selection, download progress, settings sheet,
// banner) follows the APP theme — not the reader's paper themes (sepia/dark).
// This maps the chrome's color slots onto live Tamagui theme tokens so the
// chrome reacts to app light/dark, replacing the fixed QURAN_UI_COLORS palette.
//
// Values are typed as hex strings: these colors flow into BOTH Tamagui props
// (whose color type accepts `#${string}` but not bare `string`) and RN
// consumers like lucide icons / ActivityIndicator (which need a real color
// string). A resolved theme value (`.val`) satisfies both at runtime.
type ThemeColor = `#${string}`;

export type QuranChromeColors = {
  accent: ThemeColor;
  accentWarning: ThemeColor;
  background: ThemeColor;
  cardBackground: ThemeColor;
  cardBorder: ThemeColor;
  text: ThemeColor;
  subtleText: ThemeColor;
  progressTrack: ThemeColor;
};

export const useQuranChromeColors = (): QuranChromeColors => {
  const theme = useTheme();
  return {
    accent: theme.accentPrimary.val as ThemeColor,
    accentWarning: theme.warning.val as ThemeColor,
    background: theme.background.val as ThemeColor,
    cardBackground: theme.backgroundSecondary.val as ThemeColor,
    cardBorder: theme.borderColor.val as ThemeColor,
    text: theme.color.val as ThemeColor,
    subtleText: theme.typographySecondary.val as ThemeColor,
    progressTrack: theme.backgroundMuted.val as ThemeColor,
  };
};
