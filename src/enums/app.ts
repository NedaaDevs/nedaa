export enum AppLocale {
  EN = "en",
  AR = "ar",
  UR = "ur",
  MS = "ms",
}

export const PlatformType = {
  IOS: "ios",
  ANDROID: "android",
} as const;
export type PlatformTypeValue = (typeof PlatformType)[keyof typeof PlatformType];

export enum AppMode {
  SYSTEM = "system",
  LIGHT = "light",
  DARK = "dark",
  /** Follows the prayer-day phases: light by day, dark from Maghrib. */
  ADAPTIVE = "adaptive",
}

export enum AppDirection {
  RTL = "rtl",
  LTR = "ltr",
}

/**
 * Tab the app opens on. Values are expo-router route names under (tabs).
 * Athkar and Quran are conditionally available, so a stored value is always
 * re-checked against what the user can actually reach.
 */
export const OpeningTab = {
  HOME: "index",
  ATHKAR: "athkar",
  QURAN: "quran",
  TOOLS: "tools",
} as const;

export type OpeningTabValue = (typeof OpeningTab)[keyof typeof OpeningTab];

/** Tab routes the bar never shows; links and back controls reach them. */
export const HiddenTab = {
  COMPASS: "compass",
  QADA: "qada",
  SETTINGS: "settings",
} as const;

/** In-app text size preset. Values are storage keys — never rename persisted ones. */
export const TextSize = {
  DEFAULT: "default",
  LARGE: "large",
  XLARGE: "xlarge",
  MAX: "max",
} as const;

export type TextSizeValue = (typeof TextSize)[keyof typeof TextSize];
