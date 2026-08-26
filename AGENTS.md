# Working on Nedaa

Nedaa is a prayer times app for iOS and Android — prayer times, Athan and Iqama notifications, alarms, Athkar, Qibla, Hijri dates, and widgets. It is free, has no ads, and collects no analytics. Ads, tracking SDKs, paid tiers, accounts, and cloud sync are settled out-of-scope decisions (see `.github/CONTRIBUTING.md`).

This file covers what you need to write code here. For setup, see [docs/DEV-README.md](docs/DEV-README.md). For the contribution process, see [.github/CONTRIBUTING.md](.github/CONTRIBUTING.md). For a deeper map of what already exists, see [docs/agent-context/nedaa-technical.md](docs/agent-context/nedaa-technical.md) — check it before building something new, since a similar capability often exists already.

## Stack

Expo SDK 57 and React Native 0.86 with the New Architecture (mandatory), React 19, TypeScript in strict mode, React Compiler enabled. Tamagui for UI with Moti animations, Zustand for state, Expo Router for navigation, expo-sqlite for local data, i18next for translations. Package manager is **bun**, not npm or yarn; the version is pinned in `.bun-version`.

Read `package.json` for versions rather than assuming — this file deliberately doesn't repeat them.

## Where things live

```
src/
  app/            Expo Router screens. (tabs)/ is the tab nav; settings/, umrah/ are nested stacks.
  components/     UI components, grouped by feature.
  stores/         Zustand stores, one per domain.
  services/       Business logic and database access.
  adapters/       Integrations that pick between GMS and HMS implementations (e.g. adapters/location.ts).
  hooks/          Custom hooks.
  utils/          Pure utilities.
  enums/          Enums and const unions.
  types/          Shared types.
  localization/   i18n config and locale JSON.
  constants/      App constants.
  contexts/ tasks/ config/ api/   React contexts, background tasks, app config, API clients.
modules/          Local native modules: expo-alarm (AlarmKit), expo-orientation (compass),
                  expo-widget / expo-widgets, expo-custom-notification-sound, expo-diagnostics,
                  expo-hms-* (Huawei replacements, see below).
ios/NedaaWidget/  SwiftUI widget extension.
plugins/          Custom Expo config plugins.
scripts/          Build, verify, and clean scripts (build-local.ts, verify-hms-build.ts, nuke.sh).
```

## Conventions

- **Import with the `@/*` alias**, never relative paths. `@/utils/date`, not `../../utils/date`.
- **Compare against enums, not string literals.** They're in `src/enums/`. Write `ReaderViewMode.MADINAH`, not `"madinah"`.
- **New enum-likes are `const X = { ... } as const` plus a union type**, kept in `src/enums/` and referenced as `X.MEMBER`.
- **Prefer arrow function expressions**: `const useThing = () => {}`, not `function useThing() {}`.
- **All user-facing text goes through `t("…")`.** The app ships in English, Arabic, Malay, and Urdu with full RTL, so hardcoded strings break more than English. Only `en.json` and `ar.json` are edited by hand; the rest belong to Crowdin and are overwritten.
- **Comments explain what the code does and why**, for someone reading it fresh. Keep them short. Don't narrate history — no "no longer" or "used to".

## Accessibility

Every interactive element needs:

- `accessibilityRole` (`button`, `switch`, `radio`, `link`, `header`, `adjustable`)
- `accessibilityLabel`, via `t("a11y.*")` on user-facing screens
- `accessibilityState` where the element has state (`selected`, `disabled`, `checked`)
- `accessibilityHint` when the action isn't obvious
- A touch target of at least 44x44pt

Status shown only through colour needs a text alternative too.

## Tamagui notes

- Use `$token` values and `styled()` variants. Don't hardcode colours.
- Inside `Sheet.ScrollView`, put gap and spacing on an inner `YStack`. Tamagui drops `gap` from `contentContainerStyle`, so it silently does nothing there. Keep `contentContainerStyle` for padding.

## Commands

```bash
bun start          # dev server
bun run ios        # run on iOS
bun run android    # run on Android (GMS variant; bun run android:hms for HMS)
bun run lint       # eslint via expo lint
bunx tsc --noEmit  # typecheck — no script exists for it
bunx jest          # run the jest suite once
bunx jest src/stores/__tests__/toast.test.ts   # one file
```

`bun run test` is `jest --watchAll` — watch mode, it hangs a non-interactive session. `bun test` runs Bun's own test runner, not the project's jest suite; don't use it. Tests live in `__tests__/` folders colocated with the code under `src/`.

CI (`.github/workflows/code-quality.yml`) runs lint, a Prettier format check, and the HMS source gate — it does **not** run jest. Run `act -j quality-checks` to test the workflow locally.

## Android ships two variants: GMS and HMS

The `BUILD_VARIANT` env var (`gms` by default, `hms` for Huawei devices without Google services) selects which native modules `android/settings.gradle` includes. HMS builds swap in the `modules/expo-hms-*` fail-closed replacements (notifications, location, app integrity, store review) and reject `com.google.android.gms` dependencies. `modules/expo-orientation` picks its `src/gms/java` or `src/hms/java` source set the same way.

- After touching Android native code or dependencies, verify both variants: `bun run verify:android`.
- HMS release builds need the `AGCONNECT_SERVICES_JSON` secret, copied to `android/app/agconnect-services.json` during `eas-build-pre-install`.
- Adding a Google dependency anywhere breaks HMS. Gate it behind an adapter or module boundary instead — see `src/adapters/location.ts` for the pattern.

## Environment

`.env.example` leaves `EXPO_PUBLIC_API_URL` blank on purpose. Prayer times fetching, Quran downloads, and feedback go through that API; everything else works offline. Network failures in those areas during development are expected, not a bug you introduced.

## Be careful with the native folders

- **`ios/` and `android/` are committed.** This project doesn't regenerate them on every build, and both contain hand-written code that `expo prebuild` will silently destroy — the widget extension target, alarm intent handling in `MainActivity.kt`. After changing a native dependency, run `pod install`. Don't reach for `prebuild`.
- **Native modules are autolinked** through each module's `expo-module.config.json`, not through `app.json` plugins.
- **`react-native-worklets` is patched** via bun `patchedDependencies` (`patches/`). Don't bump it without re-checking the patch.
