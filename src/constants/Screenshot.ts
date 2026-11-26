/** Settings screens a shot opens as they are: they read no seed. */
export const STATIC_SCREENSHOT_SCREENS = [
  "settings",
  "settings-appearance",
  "settings-language",
  "settings-text-size",
  "settings-hijri",
  "settings-privacy",
] as const;

/** Every screen a screenshot deep link can open. */
export const SCREENSHOT_SCREENS = [
  "prayer-times",
  "reliable-alarms",
  "athkar",
  "qibla",
  "qada",
  "quran",
  "athkar-with-audio",
  "tools",
  "umrah",
  ...STATIC_SCREENSHOT_SCREENS,
] as const;

export type ScreenshotScreenKey = (typeof SCREENSHOT_SCREENS)[number];

export type StaticScreenshotScreenKey = (typeof STATIC_SCREENSHOT_SCREENS)[number];

export const SCREENSHOT_LOCALES = ["en", "ar"] as const;

export type ScreenshotLocale = (typeof SCREENSHOT_LOCALES)[number];

export const SCREENSHOT_THEMES = ["light", "dark"] as const;
