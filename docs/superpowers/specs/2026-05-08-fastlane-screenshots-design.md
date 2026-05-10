# Fastlane + Store Screenshots — Design Spec

**Date:** 2026-05-08
**Status:** Scaffold landed (commit `1fe9c89`); screenshot pipeline pending implementation

## Goal

Establish a single, reproducible pipeline for iOS App Store and Google Play store-listing updates — both text metadata and store screenshots — without disturbing the existing EAS-owned binary build/submit flow.

## Decisions

| Question                       | Decision                                                                                                                                      |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Screenshot visual style        | Branded backdrop + device frame + headline + subhead                                                                                          |
| Locales for store listings     | en-US, ar (en-US + ar-SA on iOS) — `ms`/`ur` deferred                                                                                         |
| Device sizes                   | iPhone 6.9" (1290×2796), iPhone 6.5" (1242×2688), iPad 13" (2064×2752, ahead of iPad app support), Android phone (1080×1920)                  |
| Screen lineup (7)              | Prayer times → Reliable alarms → Athkar → Qibla → Privacy → Qada → Quran                                                                      |
| Source of in-frame app content | Real RN components rendered on web (Tamagui universal) — not HTML mocks, not simulator captures                                               |
| Tooling split                  | Fastlane: text metadata + screenshots only. EAS: binary builds + submission. `eas metadata:push` (`store.config.json`) deliberately abandoned |
| iOS auth                       | App Store Connect API key (`.p8`), env-driven                                                                                                 |
| Android auth                   | Existing `google-service-account.json`                                                                                                        |
| Where the pipeline runs        | Local-only (CI is a follow-up)                                                                                                                |
| Total renders                  | 4 sizes × 2 locales × 7 screens = 56 PNGs per refresh                                                                                         |

## Architecture

Four logical modules. M3 partially done; M4 scaffold landed; M1 and M2 are the remaining build.

### M1 — Web preview harness

Make every store-screenshot screen renderable in a desktop browser with deterministic, seeded state, using the real Tamagui components. Status: **not started**.

Files to create:

```
src/app/(preview)/
├── _layout.tsx                  # forces theme + locale from URL params; returns null on native
├── _seeds/                      # per-screen Zustand seed actions
├── prayer-times.tsx
├── reliable-alarms.tsx
├── athkar.tsx
├── qibla.tsx
├── privacy.tsx
├── qada.tsx
└── quran.tsx
src/shims/web/                   # web-only stubs for native modules
├── expo-orientation.ts
├── expo-alarm.ts
├── expo-sqlite.ts
├── react-native-track-player.ts
├── expo-widgets.ts
├── expo-custom-notification-sound.ts
├── expo-hms-location.ts
└── expo-media-controls.ts
```

URL contract: `http://localhost:8081/(preview)/<screen>?locale=<locale>&theme=dark&screenshot=true`. The `screenshot=true` flag globally disables Moti animations so captures are deterministic.

Mobile-bundle isolation (three layers):

1. `metro.config.js` — `resolver.resolveRequest` returns an empty stub for any import path matching `src/app/(preview)/` when `platform === 'ios' || platform === 'android'`. Native bundles never read the files.
2. `_layout.tsx` returns `null` unless `Platform.OS === 'web'`. Belt to the metro suspenders.
3. `src/shims/web/*` aliased only on web via `metro.config.js` `resolver.alias`. Native imports the real native modules unchanged.

Verification: `bun expo export --platform ios && grep -r '(preview)' dist/` should yield nothing.

Each preview screen file imports the relevant Zustand store and calls a co-located `seed()` from `_seeds/` to hydrate it with fixed data. No runtime calls to `new Date()` — all timestamps fixed in seeds.

Screen sets `<body data-screenshot-ready="true">` once Tamagui has measured + `document.fonts.ready` resolves. Playwright waits on this attribute before screenshotting.

### M2 — Playwright screenshot pipeline

Turn the M1 preview routes into 56 store-ready PNGs, deterministically. Status: **not started**.

```
scripts/screenshots/
├── package.json              # local workspace: playwright, sharp, zod
├── device-matrix.ts          # 4 viewport configs
├── screens.ts                # ordered 7 screens + slot numbers
├── headlines.en.json         # { "<screen>": { headline, subhead } }
├── headlines.ar.json
├── templates/
│   ├── frame.html            # backdrop + frame slot + headline slot, RTL-aware
│   └── frame.css             # imports Tamagui token CSS vars
├── frames/                   # SVG bezel masks per device
│   ├── iphone-6.9.svg
│   ├── iphone-6.5.svg
│   ├── ipad-13.svg
│   └── android-phone.svg
├── capture.ts                # Playwright runner
└── post.ts                   # restructures staging → store layouts
```

Capture flow per `(size × locale × screen)`:

1. `chromium.launch().newContext({ viewport, deviceScaleFactor: dpr })` at the target size.
2. Navigate to the M1 URL with locale + screenshot flags.
3. Wait for `body[data-screenshot-ready="true"]`.
4. Screenshot viewport → buffer A (the inner app screen).
5. Open `templates/frame.html`, set CSS vars: `--screen-image: url(<dataURL of A>)`, `--headline`, `--subhead`, `--bg-gradient`, `--frame-svg`, `--dir: ltr|rtl`.
6. Screenshot frame at the target output size → final PNG.
7. Write to `fastlane/screenshots/staging/<store>/<locale>/<size>/<NN>-<screen>.png`.

`post.ts` then writes from staging into the per-store paths fastlane expects:

- iOS: `fastlane/screenshots/ios/<locale>/<NN>_<size>_<screen>.png` (deliver autodetects size from filename suffix)
- Android: `fastlane/metadata/android/<locale>/images/phoneScreenshots/<NN>_<screen>.png` (and tablet folders when added)

Determinism guarantees:

- Fixed timestamps in seeds (no live clock)
- `document.fonts.ready` + `data-screenshot-ready` attribute (no async font swap)
- Animations gated off via `?screenshot=true` query param the M1 layout reads

Failure modes (each fails fast with a clear message):

- Web server not up → exit 1, suggest `bun screenshots:web`
- Missing `headlines.<locale>.<screen>` → zod schema validation at startup
- Font-not-loaded after 5 s → throw, do not ship blurry fallback
- Frame SVG missing → throw

Root `package.json` scripts:

```jsonc
{
  "screenshots:web": "expo start --web",
  "screenshots:capture": "tsx scripts/screenshots/capture.ts",
  "screenshots:full": "concurrently -k -s first 'npm:screenshots:web' 'wait-on http-get://localhost:8081 && npm:screenshots:capture'",
  "screenshots:post": "tsx scripts/screenshots/post.ts",
}
```

### M3 — Android fastlane (extend existing)

Status: **partially done**. The 4 lanes (`validate_metadata`, `update_metadata`, `update_listing`, `update_changelogs`) shipped in `1fe9c89`. Remaining work, all populated by M2:

- `fastlane/metadata/android/<locale>/changelogs/default.txt`
- `fastlane/metadata/android/<locale>/images/icon.png` (512×512)
- `fastlane/metadata/android/<locale>/images/featureGraphic.png` (1024×500) — generated from M2 brand template
- `fastlane/metadata/android/<locale>/images/phoneScreenshots/*.png` (M2 output)

The existing `update_listing` lane uploads everything except APK/AAB and changelogs — once M2 populates `phoneScreenshots/`, no Fastfile edits are needed. The new `update_changelogs` lane handles release-note pushes independently.

### M4 — iOS fastlane (new)

Status: **scaffold landed in `1fe9c89`**. The 4 lanes (`validate_metadata` via `precheck`, `update_metadata`, `update_screenshots`, `update_listing`) and all listing text are committed. Remaining work:

1. **User generates ASC API key** at App Store Connect → Users and Access → Integrations → App Store Connect API. Role: App Manager (least-privilege; not Admin).
2. Save `.p8` as `fastlane/AuthKey_<KEYID>.p8` (gitignored).
3. Copy `fastlane/.env.example` → `fastlane/.env` (gitignored), fill `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_PATH`, `APPLE_ID`, `ITC_TEAM_ID`.
4. First run: `cd fastlane && fastlane ios validate_metadata` (precheck against ASC). Should report any blockers without uploading.
5. M2 output is wired in by `update_screenshots` — no further Fastfile changes.

## Build sequence

1. **M1 ships first** — without the web preview routes, M2 has nothing to capture. Smallest end-to-end milestone: one screen (Prayer times) renders at `localhost:8081/(preview)/prayer-times?locale=en` with seeded data.
2. **M2 wires Playwright on top of M1** — smallest milestone: one size × one locale × one screen produces a final composited PNG in `fastlane/screenshots/ios/en-US/`.
3. Scale the M2 matrix to the full 56 once one cell works end-to-end.
4. M4 final wiring (ASC key) can happen any time after step 1; not on the M1/M2 critical path.
5. M3 image-side completion (featureGraphic, icon) follows once the brand template stabilizes in M2.

## Out of scope (deliberate)

- Adding `ms` / `ur` locales to either store listing — separate task.
- CI / GitHub Actions integration — local-only for v1.
- Tablet-size Android screenshots — defer until tablet build ships.
- Pixel-exact simulator captures — rejected in favor of universal Tamagui rendering.
- Replacing EAS for binary builds or submissions — fastlane stays metadata + screenshots only.

## File-system contract summary

```
fastlane/
├── Appfile                          # Android + iOS platform blocks
├── Fastfile                         # 4 android + 4 ios lanes
├── .env                             # gitignored; ASC key env vars
├── .env.example                     # template
├── AuthKey_<KEYID>.p8               # gitignored
├── metadata/
│   ├── android/
│   │   ├── ar/{title,short_description,full_description}.txt
│   │   ├── en-US/{title,short_description,full_description}.txt
│   │   ├── <locale>/changelogs/default.txt           # to add
│   │   └── <locale>/images/{icon.png, featureGraphic.png, phoneScreenshots/}  # to add
│   └── ios/
│       ├── {copyright,primary_category,secondary_category}.txt
│       ├── en-US/{name,subtitle,description,keywords,promotional_text,release_notes,support_url,marketing_url,privacy_url}.txt
│       └── ar-SA/<same>.txt
└── screenshots/
    ├── staging/                     # M2 intermediate; gitignored
    ├── ios/<locale>/                # M2 post output; deliver picks up
    └── (Android screenshots live under metadata/android/<locale>/images/)
scripts/screenshots/                 # M2 implementation
src/app/(preview)/                   # M1 web routes
src/shims/web/                       # M1 native-module stubs
```
