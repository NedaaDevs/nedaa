import Constants from "expo-constants";

// Sourced from app.config.js `extra.screenshotMode`, delivered natively via
// expo-constants and re-evaluated every build. This avoids the Metro
// source-keyed transform cache that pins a babel-inlined
// `process.env.EXPO_PUBLIC_*` value (the env is not part of that cache key).
// The process.env path is kept as a fallback for bundlers where it inlines
// correctly (e.g. iOS).
export const IS_SCREENSHOT_MODE =
  Constants.expoConfig?.extra?.screenshotMode === true ||
  process.env.EXPO_PUBLIC_SCREENSHOT_MODE === "1";
