import type { ColorSchemeName } from "react-native";

import { AppMode } from "@/enums/app";

// The native color scheme to force via Appearance.setColorScheme so OS-rendered
// surfaces (system dialogs, the keyboard, share sheets, the window background)
// match the in-app appearance. An explicit Light/Dark pins both the native and
// JS layers; "system" ("unspecified") hands control back to the OS. Without this
// the native layer follows the phone's day/night while the themed UI stays on the
// user's choice, leaving a mixed light/dark UI.
export const nativeColorSchemeFor = (mode: AppMode): ColorSchemeName => {
  switch (mode) {
    case AppMode.DARK:
      return "dark";
    case AppMode.LIGHT:
      return "light";
    default:
      return "unspecified";
  }
};

/**
 * Tamagui theme names. Classic keeps the pre-2.10 brand ink and blue app bar;
 * it is a palette, not a mode, so each palette has a light and a dark variant.
 */
export const ThemeName = {
  LIGHT: "light",
  DARK: "dark",
  CLASSIC_LIGHT: "classicLight",
  CLASSIC_DARK: "classicDark",
} as const;

export type ThemeNameValue = (typeof ThemeName)[keyof typeof ThemeName];

/**
 * Picks the Tamagui theme from the user's mode, the OS scheme, and whether they
 * opted into Classic colours.
 */
export const resolveThemeName = (
  mode: AppMode,
  systemScheme: ColorSchemeName,
  classicColors: boolean
): ThemeNameValue => {
  const dark = mode === AppMode.SYSTEM ? systemScheme === "dark" : mode === AppMode.DARK;
  if (classicColors) return dark ? ThemeName.CLASSIC_DARK : ThemeName.CLASSIC_LIGHT;
  return dark ? ThemeName.DARK : ThemeName.LIGHT;
};

/**
 * Whether a theme name is a dark variant. Prefer this to comparing against
 * "dark" — that misses classicDark and silently leaves light-on-light chrome.
 */
export const isDarkTheme = (themeName: string): boolean =>
  themeName === ThemeName.DARK || themeName === ThemeName.CLASSIC_DARK;
