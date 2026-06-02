// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // dist: build output. scripts: standalone bun/node tooling (bun:sqlite,
    // import.meta) outside the Expo app's tsconfig, so the app lint can't
    // resolve their imports.
    ignores: ["dist/*", "scripts/**"],
  },
  {
    // React Compiler checks (eslint-plugin-react-hooks v6, enabled as errors by
    // eslint-config-expo 56) flag many pre-existing patterns across the app.
    // They're advisory and don't change runtime, so keep them visible as
    // warnings during migration instead of blocking CI. The classic
    // rules-of-hooks / exhaustive-deps rules stay at their default (error).
    rules: {
      "react-hooks/purity": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
    },
  },
]);
