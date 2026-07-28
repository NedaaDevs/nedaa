export enum AppLocale {
  EN = "en",
  AR = "ar",
  UR = "ur",
  MS = "ms",
}

export enum PlatformType {
  IOS = "ios",
  ANDROID = "android",
}

export enum AppMode {
  SYSTEM = "system",
  LIGHT = "light",
  DARK = "dark",
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
