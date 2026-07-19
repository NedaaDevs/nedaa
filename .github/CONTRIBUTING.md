# Contributing to Nedaa

Thanks for taking the time. Nedaa is a prayer times app for iOS and Android, and it stays free with no ads and no tracking.

For getting the project running locally — prerequisites, builds, simulators, troubleshooting — see the [Developer Guide](../docs/DEV-README.md).

## Before you write code

Open an issue first if the change is more than a small fix. It lets us agree on the approach and point you at the parts of the codebase you'll need, so your time goes into something we can merge.

Small fixes — a typo, a crash with an obvious cause, a broken link — can go straight to a pull request.

## Pull requests

Branch off `master` and open a pull request against it. Please don't push directly to `master`.

Commit messages are one line: `type(scope): concise message`. For example:

```
fix(alarm): stop snooze firing after dismiss
feat(qibla): add calibration hint
docs(readme): correct calculation method count
```

Before you push, run:

```bash
bun run lint
bun test
```

A pre-commit hook runs ESLint and Prettier on staged files, so formatting is handled for you.

## Running without the API

Prayer times, Quran downloads, and feedback go through our API, and `.env.example` leaves `EXPO_PUBLIC_API_URL` blank. A fresh clone won't fetch any of those.

Most of the app doesn't need it. Athkar, the Qibla compass, Hijri dates and the converter, the Umrah guide, Qada, and all of the UI, theming, translations, and RTL work fine offline. If your change is in one of those areas, copy `.env.example` to `.env`, leave the URL empty, and carry on.

If you're working on something that does need the API, email <support@nedaa.dev> and we'll give you a development endpoint. We don't publish it because it's unauthenticated and we cover the running costs.

## Conventions worth knowing

These are the ones you can't guess from reading a single file:

- **Imports use the `@/*` alias**, not relative paths. `import { x } from "@/utils/date"`, never `"../../utils/date"`.
- **Compare against enums, not string literals.** They live in `src/enums/`. Write `ReaderViewMode.MADINAH`, not `"madinah"`.
- **Every interactive element needs accessibility props** — `accessibilityRole`, `accessibilityLabel`, and `accessibilityState` where the element has state. Touch targets are 44x44pt minimum. User-facing labels go through `t("a11y.*")` so they translate.
- **All user-facing text goes through `t("…")`.** The app ships in four languages with full RTL, so hardcoded strings break more than English.

`AGENTS.md` in the repo root has more, and is a reasonable thing to hand to a coding assistant.

## Translations

Translations are managed in [Crowdin](https://crowdin.com/project/nedaa-v2), not in pull requests.

If you want to translate, join the project there and pick your language. If your language isn't listed, open a discussion in Crowdin and we'll add it.

Two things to know if you're editing code that touches localization:

- `src/localization/locales/en.json` is the source of truth. Arabic (`ar.json`) is maintained by hand as well.
- Every other locale file is owned by Crowdin and gets overwritten on the next download. Don't edit them directly — your changes will disappear.

A language only becomes selectable once it's listed in `AppLocale` (`src/enums/app.ts`). We keep a locale gated there until its translation coverage is good enough to ship.

## Out of scope

Nedaa is deliberately narrow, and these are settled decisions rather than open questions:

- Ads, or any analytics or tracking SDK.
- Paid tiers, subscriptions, or a premium build.
- User accounts, login, or cloud sync.
- A social feed, donations, or a halal restaurant directory.

The app is a prayer times companion. Features that make it a general-purpose Islamic super-app are out of scope.

## Questions

Email <support@nedaa.dev> or open an issue.
