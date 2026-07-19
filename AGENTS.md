# Working on Nedaa

Nedaa is a prayer times app for iOS and Android — prayer times, Athan and Iqama notifications, alarms, Athkar, Qibla, Hijri dates, and widgets. It's free, has no ads, and collects no analytics or telemetry.

This file covers what you need to write code here. For setup, see [docs/DEV-README.md](docs/DEV-README.md). For the contribution process, see [.github/CONTRIBUTING.md](.github/CONTRIBUTING.md). For a deeper map of what already exists, see [docs/agent-context/nedaa-technical.md](docs/agent-context/nedaa-technical.md) — check it before building something new, since a similar capability often exists already.

## Stack

Expo and React Native with the New Architecture, React, TypeScript in strict mode. Tamagui for UI with Moti animations, Zustand for state, Expo Router for navigation, expo-sqlite for local data, i18next for translations. Package manager is **bun**, not npm or yarn.

Read `package.json` for versions rather than assuming — this file deliberately doesn't repeat them.

## Where things live

```
src/
  app/            Expo Router screens. (tabs)/ is the tab nav; settings/, umrah/ are nested stacks.
  components/     UI components, grouped by feature.
  stores/         Zustand stores, one per domain.
  services/       Business logic and database access.
  hooks/          Custom hooks.
  utils/          Pure utilities.
  enums/          Enums and const unions.
  types/          Shared types.
  localization/   i18n config and locale JSON.
  constants/      App constants.
modules/          Custom native modules (alarms, compass, widgets, notification sounds).
ios/NedaaWidget/  SwiftUI widget extension.
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
bun run android    # run on Android
bun test           # jest
bun run lint       # eslint
```

## Commits

One line: `type(scope): concise message`. For example `fix(alarm): stop snooze firing after dismiss`.

A pre-commit hook runs ESLint and Prettier on staged files.

## Two things to be careful about

- **`ios/` and `android/` are committed.** This project doesn't regenerate them on every build, and both contain hand-written code that `expo prebuild` will silently destroy — the widget extension target, alarm intent handling in `MainActivity.kt`. After changing a native dependency, run `pod install`. Don't reach for `prebuild`.
- **Native modules are autolinked** through each module's `expo-module.config.json`, not through `app.json` plugins.
