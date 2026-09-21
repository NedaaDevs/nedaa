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
    // Every React Compiler rule runs at the preset severity (error): a hit is a
    // compiler bail-out for that component, not advisory noise. Reanimated shared
    // values read with .get() and write with .set(); the compiler treats
    // `.value =` as an illegal mutation.
    rules: {},
  },
  {
    // Type-aware pass flagging every use of an @deprecated API (e.g. reanimated's
    // runOnUI). Warning, not error: deprecations are advisory until the dep that
    // owns them is upgraded.
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
    rules: {
      "@typescript-eslint/no-deprecated": "warn",
    },
  },
  {
    // Test suites still render through react-test-renderer, deprecated in React 19.
    // Silence the deprecation for tests until they move to
    // @testing-library/react-native; production code keeps the check.
    files: ["src/**/__tests__/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-deprecated": "off",
    },
  },
  {
    // Card owns the surface treatment (background, radius, elevation). Painting
    // $backgroundSecondary by hand is what drove the radius and padding drift
    // Card exists to fix. The ui/ primitives and the player/tab chrome that
    // legitimately paint their own surface are exempt below.
    files: ["src/**/*.tsx"],
    rules: {
      "no-restricted-syntax": [
        "warn",
        {
          selector: 'JSXAttribute[name.name="backgroundColor"][value.value="$backgroundSecondary"]',
          message:
            "Use <Card> (or Card.Pressable) instead of painting $backgroundSecondary by hand.",
        },
      ],
    },
  },
  {
    // Primitives and chrome that own their surface: the ui/ building blocks, the
    // tab bar, and the audio player bars and sheet frames.
    files: [
      "src/components/ui/**/*.tsx",
      "src/app/(tabs)/_layout.tsx",
      "src/components/athkar/AudioControls.tsx",
      "src/components/athkar/MiniPlayerBar.tsx",
      "src/components/athkar/PlayerBottomSheet.tsx",
    ],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
]);
