// Dynamic Expo config. Expo merges this over app.json (received as `config`).
// It injects the screenshot-mode flag into `extra` at config-eval time, which
// Expo re-evaluates on every build/prebuild — unlike `process.env.EXPO_PUBLIC_*`
// substitution, which babel-preset-expo inlines into a JS module that Metro
// then caches by source hash (env is not part of that cache key). The value is
// delivered natively and read at runtime via expo-constants in
// `src/screenshot-mode/flag.ts`.
export default ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    screenshotMode: process.env.EXPO_PUBLIC_SCREENSHOT_MODE === "1",
  },
});
