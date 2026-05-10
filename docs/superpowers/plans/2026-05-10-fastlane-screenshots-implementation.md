# Fastlane Store Screenshots — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the M1 web preview harness and M2 Playwright capture pipeline so that running `fastlane ios update_screenshots` (or the Android equivalent) regenerates and uploads all 56 store-listing PNGs from real Tamagui components, deterministically, on a developer's laptop.

**Architecture:** Expo Router `(preview)` group routes render seeded versions of 7 store screens on web, using web-only shims for native modules. Playwright captures each screen at 4 device viewports × 2 locales, composites the capture into a branded device frame with localized headlines, and writes the result into the per-store paths fastlane's `deliver` and `supply` actions expect.

**Tech Stack:** Expo Router 6, Tamagui 2.0.0-rc.41, Zustand 5, Playwright (new), sharp (new), zod (new), tsx (new dev dep). Fastlane 2.233.1 (already installed).

**Spec:** `docs/superpowers/specs/2026-05-08-fastlane-screenshots-design.md`

**Prerequisites done:**

- Fastlane scaffold for both platforms shipped in commit `1fe9c89`
- iOS listing text drafted in `fastlane/metadata/ios/{en-US,ar-SA}/`
- Spec committed in `c7b6e14`

---

## File Structure

### M1 (web preview harness)

| Path                                              | Responsibility                                                                            | Status                        |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------- |
| `metro.config.js`                                 | Add platform-conditional resolveRequest blocking `(preview)` on native + web shim aliases | modify (or create if missing) |
| `src/app/(preview)/_layout.tsx`                   | Wraps preview routes; reads `?locale=&theme=` URL params; returns `null` on native        | create                        |
| `src/app/(preview)/_seeds/index.ts`               | Centralized seed registry — one function per screen                                       | create                        |
| `src/app/(preview)/prayer-times.tsx`              | Prayer times screen at fixed location/date                                                | create                        |
| `src/app/(preview)/reliable-alarms.tsx`           | Alarm-firing UI in a fixed state                                                          | create                        |
| `src/app/(preview)/athkar.tsx`                    | Athkar list with partial progress                                                         | create                        |
| `src/app/(preview)/qibla.tsx`                     | Qibla compass at fixed heading                                                            | create                        |
| `src/app/(preview)/privacy.tsx`                   | Brand/positioning screen — no app counterpart                                             | create                        |
| `src/app/(preview)/qada.tsx`                      | Qada tracker with seeded counts                                                           | create                        |
| `src/app/(preview)/quran.tsx`                     | Quran reader at a fixed page                                                              | create                        |
| `src/shims/web/expo-orientation.ts`               | Returns a static heading                                                                  | create                        |
| `src/shims/web/expo-alarm.ts`                     | Noop authorization + scheduling stubs                                                     | create                        |
| `src/shims/web/expo-sqlite.ts`                    | In-memory shim returning fixture data                                                     | create                        |
| `src/shims/web/react-native-track-player.ts`      | Noop player + event emitter                                                               | create                        |
| `src/shims/web/expo-widgets.ts`                   | Noop                                                                                      | create                        |
| `src/shims/web/expo-custom-notification-sound.ts` | Noop                                                                                      | create                        |
| `src/shims/web/expo-hms-location.ts`              | Noop                                                                                      | create                        |
| `src/shims/web/expo-media-controls.ts`            | Noop                                                                                      | create                        |
| `src/utils/screenshot-mode.ts`                    | `isScreenshotMode()` helper that reads URL flag; reused by Moti animations                | create                        |

### M2 (Playwright pipeline)

| Path                                              | Responsibility                                                    |
| ------------------------------------------------- | ----------------------------------------------------------------- |
| `scripts/screenshots/package.json`                | Local dependencies for the script (playwright, sharp, zod, tsx)   |
| `scripts/screenshots/tsconfig.json`               | TS config for the standalone script                               |
| `scripts/screenshots/device-matrix.ts`            | 4 viewport × store configs                                        |
| `scripts/screenshots/screens.ts`                  | Ordered 7-screen list with slot numbers                           |
| `scripts/screenshots/headlines.en.json`           | English copy for each screen                                      |
| `scripts/screenshots/headlines.ar.json`           | Arabic copy for each screen                                       |
| `scripts/screenshots/headlines.schema.ts`         | zod schema validating headline files at startup                   |
| `scripts/screenshots/templates/frame.html`        | Branded backdrop + device frame slot + headline slot, RTL-aware   |
| `scripts/screenshots/templates/frame.css`         | Frame template styles, imports Tamagui token CSS vars             |
| `scripts/screenshots/frames/iphone-6.9.svg`       | iPhone 6.9" bezel mask                                            |
| `scripts/screenshots/frames/iphone-6.5.svg`       | iPhone 6.5" bezel mask                                            |
| `scripts/screenshots/frames/ipad-13.svg`          | iPad 13" bezel mask                                               |
| `scripts/screenshots/frames/android-phone.svg`    | Android phone bezel mask                                          |
| `scripts/screenshots/capture.ts`                  | Main Playwright runner — iterates the matrix, writes staging PNGs |
| `scripts/screenshots/post.ts`                     | Restructures staging into per-store paths                         |
| `scripts/screenshots/__tests__/headlines.test.ts` | Schema validation test                                            |
| `scripts/screenshots/__tests__/post.test.ts`      | Path-mapping logic test                                           |
| `package.json` (root)                             | Add `screenshots:*` npm scripts                                   |

---

## Phase 1: M1 — Web Preview Harness

### Task 1: Add tsx dev dependency

**Files:**

- Modify: `package.json` (root)

- [ ] **Step 1: Install tsx as a dev dependency**

Run: `bun add -D tsx`
Expected: `package.json` now lists `tsx` under `devDependencies`.

- [ ] **Step 2: Commit**

```bash
git add package.json bun.lock
git commit -m "chore(deps): add tsx for screenshots script execution"
```

---

### Task 2: Add screenshot-mode helper

**Files:**

- Create: `src/utils/screenshot-mode.ts`

- [ ] **Step 1: Implement helper**

```ts
import { Platform } from "react-native";

export function isScreenshotMode(): boolean {
  if (Platform.OS !== "web") return false;
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("screenshot") === "true";
}
```

- [ ] **Step 2: Verify TypeScript compile**

Run: `bun run lint`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/utils/screenshot-mode.ts
git commit -m "feat(utils): add isScreenshotMode helper for preview routes"
```

---

### Task 3: Create web shim for expo-orientation

**Files:**

- Create: `src/shims/web/expo-orientation.ts`

- [ ] **Step 1: Implement shim**

```ts
// Web-only shim for the native expo-orientation module. Used by store-screenshot
// preview routes; returns a fixed heading instead of reading sensors.
export const FIXED_HEADING = 42;

export function useHeading() {
  return { heading: FIXED_HEADING, accuracy: 1 };
}

export async function startHeadingUpdates() {}
export async function stopHeadingUpdates() {}
export async function getCurrentHeading() {
  return { heading: FIXED_HEADING, accuracy: 1 };
}

export default {
  useHeading,
  startHeadingUpdates,
  stopHeadingUpdates,
  getCurrentHeading,
};
```

- [ ] **Step 2: Verify the real module's exported surface**

Run: `grep -h '^export' modules/expo-orientation/src/*.ts`
Expected: shim covers each exported name. If new exports exist in the real module, add corresponding noops to the shim.

- [ ] **Step 3: Commit**

```bash
git add src/shims/web/expo-orientation.ts
git commit -m "feat(shims): add web shim for expo-orientation"
```

---

### Task 4: Create web shims for remaining native modules

**Files:**

- Create: `src/shims/web/expo-alarm.ts`
- Create: `src/shims/web/expo-sqlite.ts`
- Create: `src/shims/web/react-native-track-player.ts`
- Create: `src/shims/web/expo-widgets.ts`
- Create: `src/shims/web/expo-custom-notification-sound.ts`
- Create: `src/shims/web/expo-hms-location.ts`
- Create: `src/shims/web/expo-media-controls.ts`

- [ ] **Step 1: Implement expo-alarm shim**

```ts
// Web-only shim for expo-alarm. Authorization always granted; schedule is a noop.
export const AlarmAuthorizationStatus = {
  notDetermined: 0,
  denied: 1,
  authorized: 2,
} as const;

export async function requestAuthorization() {
  return AlarmAuthorizationStatus.authorized;
}
export async function getAuthorizationStatus() {
  return AlarmAuthorizationStatus.authorized;
}
export async function scheduleAlarm() {}
export async function cancelAlarm() {}
export async function listAlarms(): Promise<unknown[]> {
  return [];
}

export default {
  AlarmAuthorizationStatus,
  requestAuthorization,
  getAuthorizationStatus,
  scheduleAlarm,
  cancelAlarm,
  listAlarms,
};
```

- [ ] **Step 2: Implement expo-sqlite shim**

```ts
// Web-only shim for expo-sqlite. Returns an in-memory database that throws on
// real queries — preview routes seed Zustand stores directly and should not
// hit the DB. This shim only exists so module-level imports do not crash.
export class SQLiteDatabase {
  closed = false;
  async execAsync(_sql: string) {}
  async runAsync(_sql: string, ..._args: unknown[]) {
    return { lastInsertRowId: 0, changes: 0 };
  }
  async getFirstAsync<T>(_sql: string, ..._args: unknown[]): Promise<T | null> {
    return null;
  }
  async getAllAsync<T>(_sql: string, ..._args: unknown[]): Promise<T[]> {
    return [];
  }
  async closeAsync() {
    this.closed = true;
  }
}

export async function openDatabaseAsync(_name: string) {
  return new SQLiteDatabase();
}
export function openDatabaseSync(_name: string) {
  return new SQLiteDatabase();
}

export default { openDatabaseAsync, openDatabaseSync, SQLiteDatabase };
```

- [ ] **Step 3: Implement react-native-track-player shim**

```ts
// Web-only shim for react-native-track-player. All methods are noops; events
// are never emitted.
export const Event = {
  PlaybackState: "playback-state",
  PlaybackTrackChanged: "playback-track-changed",
} as const;

export const State = {
  None: "none",
  Playing: "playing",
  Paused: "paused",
  Stopped: "stopped",
} as const;

export const Capability = {
  Play: "play",
  Pause: "pause",
  Stop: "stop",
} as const;

const TrackPlayer = {
  setupPlayer: async () => {},
  updateOptions: async () => {},
  add: async () => {},
  remove: async () => {},
  reset: async () => {},
  play: async () => {},
  pause: async () => {},
  stop: async () => {},
  getState: async () => State.None,
  getCurrentTrack: async () => null,
  addEventListener: () => ({ remove: () => {} }),
};

export function useTrackPlayerEvents() {}
export function useProgress() {
  return { position: 0, duration: 0, buffered: 0 };
}
export default TrackPlayer;
```

- [ ] **Step 4: Implement remaining noop shims**

Write these four files. Each is a default-exported empty object plus named noops the consuming code uses. If the consuming code references a name not in the shim, add it.

`src/shims/web/expo-widgets.ts`:

```ts
export async function reloadAllTimelines() {}
export async function setItem(_key: string, _value: string) {}
export async function getItem(_key: string): Promise<string | null> {
  return null;
}
export default { reloadAllTimelines, setItem, getItem };
```

`src/shims/web/expo-custom-notification-sound.ts`:

```ts
export async function setNotificationSound(_path: string) {}
export async function clearNotificationSound() {}
export default { setNotificationSound, clearNotificationSound };
```

`src/shims/web/expo-hms-location.ts`:

```ts
export async function getCurrentLocation() {
  return null;
}
export async function requestLocationPermission() {
  return "denied" as const;
}
export default { getCurrentLocation, requestLocationPermission };
```

`src/shims/web/expo-media-controls.ts`:

```ts
export async function enable() {}
export async function disable() {}
export async function updateMetadata(_meta: Record<string, unknown>) {}
export default { enable, disable, updateMetadata };
```

- [ ] **Step 5: Verify each shim compiles**

Run: `bun run lint`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add src/shims/web/
git commit -m "feat(shims): add web shims for remaining native modules"
```

---

### Task 5: Wire shims + preview-route gating into Metro config

**Files:**

- Modify or create: `metro.config.js`

- [ ] **Step 1: Inspect existing metro.config.js**

Run: `cat metro.config.js 2>/dev/null || echo "FILE MISSING"`
Expected: file either exists with current config to extend, or is missing entirely. If missing, the next step creates it from the Expo default.

- [ ] **Step 2: Write the updated config**

If `metro.config.js` does not exist, create it with the full content below. If it does exist, integrate the `resolver.alias` and `resolver.resolveRequest` blocks shown below into the existing config without removing other settings.

```js
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

const WEB_SHIM_DIR = path.join(projectRoot, "src/shims/web");
const WEB_SHIMS = {
  "expo-orientation": path.join(WEB_SHIM_DIR, "expo-orientation.ts"),
  "expo-alarm": path.join(WEB_SHIM_DIR, "expo-alarm.ts"),
  "expo-sqlite": path.join(WEB_SHIM_DIR, "expo-sqlite.ts"),
  "react-native-track-player": path.join(WEB_SHIM_DIR, "react-native-track-player.ts"),
  "expo-widgets": path.join(WEB_SHIM_DIR, "expo-widgets.ts"),
  "expo-custom-notification-sound": path.join(WEB_SHIM_DIR, "expo-custom-notification-sound.ts"),
  "expo-hms-location": path.join(WEB_SHIM_DIR, "expo-hms-location.ts"),
  "expo-media-controls": path.join(WEB_SHIM_DIR, "expo-media-controls.ts"),
};

const PREVIEW_ROUTE_FRAGMENT = path.join("src", "app", "(preview)");
const EMPTY_MODULE = path.join(projectRoot, "src/shims/web/__empty.ts");

const originalResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === "web" && WEB_SHIMS[moduleName]) {
    return { type: "sourceFile", filePath: WEB_SHIMS[moduleName] };
  }

  if (
    (platform === "ios" || platform === "android") &&
    moduleName.includes(PREVIEW_ROUTE_FRAGMENT)
  ) {
    return { type: "sourceFile", filePath: EMPTY_MODULE };
  }

  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
```

- [ ] **Step 3: Create the empty-module placeholder for native bundles**

```ts
// src/shims/web/__empty.ts
// Placeholder used by metro.config.js to strip preview routes from native bundles.
export default {};
```

- [ ] **Step 4: Verify Metro starts cleanly**

Run: `bun start --clear` in a terminal, wait for "Logs for your project will appear below.", then Ctrl-C.
Expected: no resolver errors at startup.

- [ ] **Step 5: Commit**

```bash
git add metro.config.js src/shims/web/__empty.ts
git commit -m "feat(metro): wire web shims and strip preview routes from native bundles"
```

---

### Task 6: Create preview layout

**Files:**

- Create: `src/app/(preview)/_layout.tsx`

- [ ] **Step 1: Write the layout**

```tsx
import { Stack } from "expo-router";
import { Platform } from "react-native";
import { useEffect } from "react";
import { useLocalSearchParams } from "expo-router";
import i18next from "i18next";

export default function PreviewLayout() {
  if (Platform.OS !== "web") return null;

  const params = useLocalSearchParams<{ locale?: string; theme?: string }>();
  const locale = params.locale ?? "en";

  useEffect(() => {
    i18next.changeLanguage(locale);
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale;
      document.documentElement.dir = locale === "ar" || locale === "ur" ? "rtl" : "ltr";
    }
  }, [locale]);

  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [ ] **Step 2: Verify lint**

Run: `bun run lint`
Expected: no errors. If there are TS errors about `useLocalSearchParams` types, follow the existing `src/app/` patterns.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(preview\)/_layout.tsx
git commit -m "feat(preview): add web-only preview route layout"
```

---

### Task 7: Add seed registry

**Files:**

- Create: `src/app/(preview)/_seeds/index.ts`

- [ ] **Step 1: Write registry skeleton**

```ts
// Each preview screen calls its corresponding seed once on mount. Seeds hydrate
// Zustand stores with deterministic data so screenshots are reproducible.

export const FIXED_DATE = new Date("2026-05-10T05:12:00Z");

export type ScreenSeed = () => void;
export type ScreenName =
  | "prayer-times"
  | "reliable-alarms"
  | "athkar"
  | "qibla"
  | "privacy"
  | "qada"
  | "quran";

export const seeds: Record<ScreenName, ScreenSeed> = {
  "prayer-times": () => {},
  "reliable-alarms": () => {},
  athkar: () => {},
  qibla: () => {},
  privacy: () => {},
  qada: () => {},
  quran: () => {},
};
```

Subsequent tasks fill in each seed.

- [ ] **Step 2: Commit**

```bash
git add src/app/\(preview\)/_seeds/index.ts
git commit -m "feat(preview): add seed registry skeleton"
```

---

### Task 8: Implement prayer-times preview screen

**Files:**

- Create: `src/app/(preview)/prayer-times.tsx`
- Modify: `src/app/(preview)/_seeds/index.ts`

- [ ] **Step 1: Inspect the real prayer times store**

Run: `ls src/stores/ | grep -i prayer`
Then read the matching file. Note its public surface: state shape, action names. Note what the real prayer times screen at `src/app/(tabs)/index.tsx` (or wherever it lives) imports and renders.

- [ ] **Step 2: Implement the seed**

Replace the `prayer-times` entry in `_seeds/index.ts` with a function that calls the actual store's setter to install fixed data. Use the store's real action names and state shape — do not invent fields. Example shape (verify against the real store):

```ts
import { usePrayerTimesStore } from "@/stores/prayerTimes";

seeds["prayer-times"] = () => {
  usePrayerTimesStore.setState({
    city: "Madinah",
    date: FIXED_DATE.toISOString().slice(0, 10),
    times: {
      fajr: "05:12",
      sunrise: "06:32",
      dhuhr: "12:34",
      asr: "15:58",
      maghrib: "18:22",
      isha: "19:51",
    },
    nextPrayerName: "dhuhr",
    nextPrayerCountdownMs: 2 * 60 * 60 * 1000 + 14 * 60 * 1000,
  });
};
```

If the real store's shape differs, mirror its actual fields — the rule is "make it look real on screen", not "match this snippet literally".

- [ ] **Step 3: Implement the screen**

```tsx
import { useEffect, useState } from "react";
import { seeds } from "./_seeds";
// Import the real screen content. Identify the real prayer-times tab screen
// (likely src/app/(tabs)/index.tsx); refactor its content into a reusable
// component if not already, and import that component here.
import { PrayerTimesScreen } from "@/components/screens/PrayerTimesScreen";

export default function PreviewPrayerTimes() {
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    seeds["prayer-times"]();
    setSeeded(true);
    if (typeof document !== "undefined") {
      requestAnimationFrame(() => {
        document.fonts.ready.then(() => {
          document.body.dataset.screenshotReady = "true";
        });
      });
    }
  }, []);
  if (!seeded) return null;
  return <PrayerTimesScreen />;
}
```

- [ ] **Step 4: Verify it renders**

Run: `bun start --web` in a terminal.
Open: `http://localhost:8081/(preview)/prayer-times?locale=en&theme=dark&screenshot=true`
Expected: prayer-times UI appears with seeded data; `document.body.dataset.screenshotReady === "true"` once fonts load.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(preview\)/prayer-times.tsx src/app/\(preview\)/_seeds/index.ts
git commit -m "feat(preview): add prayer-times preview screen with seeded data"
```

---

### Task 9: Implement reliable-alarms preview screen

**Files:**

- Create: `src/app/(preview)/reliable-alarms.tsx`
- Modify: `src/app/(preview)/_seeds/index.ts`

- [ ] **Step 1: Identify the alarm-firing UI**

Run: `grep -rln "AlarmFiring\|alarmFiring\|firing" src/components/alarm/`
The component that renders the full-screen alarm UI is the target.

- [ ] **Step 2: Implement seed + screen**

Mirror the structure of Task 8: install fixed alarm state in the store (alarm name "Fajr", trigger time = `FIXED_DATE`), render the firing-state component, mark `screenshotReady` after fonts load.

```tsx
// src/app/(preview)/reliable-alarms.tsx
import { useEffect, useState } from "react";
import { seeds } from "./_seeds";
import { AlarmFiringScreen } from "@/components/alarm/AlarmFiringScreen";

export default function PreviewReliableAlarms() {
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    seeds["reliable-alarms"]();
    setSeeded(true);
    requestAnimationFrame(() => {
      document.fonts.ready.then(() => {
        document.body.dataset.screenshotReady = "true";
      });
    });
  }, []);
  if (!seeded) return null;
  return <AlarmFiringScreen />;
}
```

For the seed body, install the alarm store's "alarm currently firing" shape using the store's real action names (read `src/stores/alarm*.ts` to find them).

- [ ] **Step 3: Verify in browser**

URL: `http://localhost:8081/(preview)/reliable-alarms?locale=en&theme=dark&screenshot=true`

- [ ] **Step 4: Commit**

```bash
git add src/app/\(preview\)/reliable-alarms.tsx src/app/\(preview\)/_seeds/index.ts
git commit -m "feat(preview): add reliable-alarms preview screen"
```

---

### Task 10: Implement remaining 5 preview screens

For each of: `athkar`, `qibla`, `privacy`, `qada`, `quran` — repeat the Task 8/9 pattern:

1. Identify the real screen + store.
2. Write the seed in `_seeds/index.ts` using the store's real action names.
3. Create `src/app/(preview)/<screen>.tsx` that calls the seed and renders the real screen.
4. Verify the route loads at `http://localhost:8081/(preview)/<screen>?locale=en&theme=dark&screenshot=true` AND `?locale=ar`.
5. Commit one screen per commit: `feat(preview): add <screen> preview screen`.

**Special notes per screen:**

- **`athkar`** — seed partial progress (e.g. 23/33 morning athkar complete) so the progress UI shows something visually interesting.
- **`qibla`** — the compass needle prop must come from the (web) `expo-orientation` shim's `FIXED_HEADING`. Verify the on-screen needle points consistently.
- **`privacy`** — has no real app counterpart. Build a Tamagui-styled marketing screen showing the "no ads, no tracking, open source" pillars. Use existing Tamagui tokens — no new colors. Treat this as a `<View>` + `<Text>` composition.
- **`qada`** — seed e.g. "12 days remaining of 30" so the countdown is visible.
- **`quran`** — point at a fixed mushaf page image (e.g. page 1 from `assets/db/quran.db`-derived asset paths). Confirm the image loads at full resolution on web — if the real reader uses a native-only image loader, swap for a plain `<Image source={{uri:...}}>` in the preview screen only.

---

### Task 11: Verify native bundles do not include preview routes

**Files:** none modified — verification only.

- [ ] **Step 1: Build iOS bundle**

Run: `bun expo export --platform ios --output-dir /tmp/nedaa-ios-export`
Expected: build succeeds.

- [ ] **Step 2: Grep for preview content**

Run: `grep -r 'preview/prayer-times\|PreviewPrayerTimes\|preview/qibla' /tmp/nedaa-ios-export || echo "CLEAN"`
Expected: prints "CLEAN".

- [ ] **Step 3: Repeat for Android**

Run: `bun expo export --platform android --output-dir /tmp/nedaa-android-export && grep -r 'preview/prayer-times\|PreviewPrayerTimes' /tmp/nedaa-android-export || echo "CLEAN"`
Expected: "CLEAN".

- [ ] **Step 4: Clean up exports**

Run: `rm -rf /tmp/nedaa-ios-export /tmp/nedaa-android-export`

If either grep finds a match, the metro `resolveRequest` rule in Task 5 is not catching the path. Adjust the substring match (`PREVIEW_ROUTE_FRAGMENT`) until both bundles are clean before proceeding to M2.

---

## Phase 2: M2 — Playwright Screenshot Pipeline

### Task 12: Bootstrap scripts/screenshots workspace

**Files:**

- Create: `scripts/screenshots/package.json`
- Create: `scripts/screenshots/tsconfig.json`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "nedaa-screenshots",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "test": "vitest run"
  },
  "dependencies": {
    "playwright": "^1.49.1",
    "sharp": "^0.34.0",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "@types/node": "^22.10.0",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "allowImportingTsExtensions": false,
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["**/*.ts", "**/*.json"]
}
```

- [ ] **Step 3: Install dependencies**

Run: `cd scripts/screenshots && bun install`
Expected: `node_modules/` populated, no peer-dep warnings that block install.

- [ ] **Step 4: Install Playwright browsers**

Run: `cd scripts/screenshots && bunx playwright install chromium`
Expected: chromium browser binary downloaded.

- [ ] **Step 5: Commit**

```bash
git add scripts/screenshots/package.json scripts/screenshots/tsconfig.json scripts/screenshots/bun.lock
git commit -m "chore(screenshots): bootstrap pipeline workspace"
```

---

### Task 13: Define device matrix

**Files:**

- Create: `scripts/screenshots/device-matrix.ts`

- [ ] **Step 1: Write the matrix**

```ts
export type DeviceTarget = {
  id: "iphone-6.9" | "iphone-6.5" | "ipad-13" | "android-phone";
  width: number;
  height: number;
  dpr: number;
  frame: string;
  store: "ios" | "android";
};

export const DEVICE_MATRIX: ReadonlyArray<DeviceTarget> = [
  { id: "iphone-6.9", width: 1290, height: 2796, dpr: 3, frame: "iphone-6.9.svg", store: "ios" },
  { id: "iphone-6.5", width: 1242, height: 2688, dpr: 3, frame: "iphone-6.5.svg", store: "ios" },
  { id: "ipad-13", width: 2064, height: 2752, dpr: 2, frame: "ipad-13.svg", store: "ios" },
  {
    id: "android-phone",
    width: 1080,
    height: 1920,
    dpr: 3,
    frame: "android-phone.svg",
    store: "android",
  },
] as const;

export const LOCALES: ReadonlyArray<"en" | "ar"> = ["en", "ar"] as const;
```

- [ ] **Step 2: Commit**

```bash
git add scripts/screenshots/device-matrix.ts
git commit -m "feat(screenshots): define device + locale matrix"
```

---

### Task 14: Define screens list

**Files:**

- Create: `scripts/screenshots/screens.ts`

- [ ] **Step 1: Write the list**

```ts
export type ScreenSpec = {
  id: "prayer-times" | "reliable-alarms" | "athkar" | "qibla" | "privacy" | "qada" | "quran";
  slot: number;
};

export const SCREENS: ReadonlyArray<ScreenSpec> = [
  { id: "prayer-times", slot: 1 },
  { id: "reliable-alarms", slot: 2 },
  { id: "athkar", slot: 3 },
  { id: "qibla", slot: 4 },
  { id: "privacy", slot: 5 },
  { id: "qada", slot: 6 },
  { id: "quran", slot: 7 },
] as const;
```

- [ ] **Step 2: Commit**

```bash
git add scripts/screenshots/screens.ts
git commit -m "feat(screenshots): define ordered screens list"
```

---

### Task 15: Add headlines schema and copy files

**Files:**

- Create: `scripts/screenshots/headlines.schema.ts`
- Create: `scripts/screenshots/headlines.en.json`
- Create: `scripts/screenshots/headlines.ar.json`
- Create: `scripts/screenshots/__tests__/headlines.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// scripts/screenshots/__tests__/headlines.test.ts
import { describe, it, expect } from "vitest";
import { headlinesSchema, validateHeadlines } from "../headlines.schema.ts";
import en from "../headlines.en.json";
import ar from "../headlines.ar.json";
import { SCREENS } from "../screens.ts";

describe("headlines", () => {
  it("conforms to schema in en", () => {
    expect(() => validateHeadlines(en)).not.toThrow();
  });
  it("conforms to schema in ar", () => {
    expect(() => validateHeadlines(ar)).not.toThrow();
  });
  it("covers every screen in en", () => {
    const parsed = headlinesSchema.parse(en);
    for (const s of SCREENS) expect(parsed[s.id]).toBeDefined();
  });
  it("covers every screen in ar", () => {
    const parsed = headlinesSchema.parse(ar);
    for (const s of SCREENS) expect(parsed[s.id]).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to confirm failure**

Run: `cd scripts/screenshots && bun run test`
Expected: FAIL — module `headlines.schema.ts` does not exist.

- [ ] **Step 3: Write the schema**

```ts
// scripts/screenshots/headlines.schema.ts
import { z } from "zod";
import { SCREENS } from "./screens.ts";

const screenIds = SCREENS.map((s) => s.id) as [string, ...string[]];

export const headlineEntrySchema = z.object({
  headline: z.string().min(1).max(80),
  subhead: z.string().min(1).max(120),
});

export const headlinesSchema = z.record(z.enum(screenIds), headlineEntrySchema);

export type Headlines = z.infer<typeof headlinesSchema>;

export function validateHeadlines(input: unknown): Headlines {
  return headlinesSchema.parse(input);
}
```

- [ ] **Step 4: Write headlines.en.json**

```json
{
  "prayer-times": {
    "headline": "Accurate prayer times, anywhere.",
    "subhead": "22 calculation methods. Works offline."
  },
  "reliable-alarms": {
    "headline": "An alarm that actually wakes you.",
    "subhead": "Real OS-level alarms, not notifications."
  },
  "athkar": {
    "headline": "Daily athkar, focused.",
    "subhead": "Hisn al-Muslim with audio. Yours to keep."
  },
  "qibla": {
    "headline": "Find the qibla, instantly.",
    "subhead": "Calibrated compass, anywhere on earth."
  },
  "privacy": {
    "headline": "No ads. No tracking. No paywall.",
    "subhead": "Open source. Free. Always."
  },
  "qada": {
    "headline": "Track missed Ramadan fasts.",
    "subhead": "Make them up before next Ramadan."
  },
  "quran": {
    "headline": "Read the Quran, beautifully.",
    "subhead": "Madinah mushaf, offline."
  }
}
```

- [ ] **Step 5: Write headlines.ar.json**

```json
{
  "prayer-times": {
    "headline": "مواقيت صلاة دقيقة في كل مكان.",
    "subhead": "٢٢ طريقة حساب. تعمل بدون إنترنت."
  },
  "reliable-alarms": {
    "headline": "منبه يوقظك فعلاً.",
    "subhead": "منبه حقيقي على مستوى النظام، لا مجرد إشعار."
  },
  "athkar": {
    "headline": "أذكارك اليومية، بتركيز.",
    "subhead": "حصن المسلم بالصوت. معك دائماً."
  },
  "qibla": {
    "headline": "حدد القبلة فوراً.",
    "subhead": "بوصلة معايرة في أي مكان."
  },
  "privacy": {
    "headline": "بدون إعلانات. بدون تتبع. بدون اشتراك.",
    "subhead": "مفتوح المصدر. مجاني. دائماً."
  },
  "qada": {
    "headline": "تتبع أيام الصيام الفائتة.",
    "subhead": "اقضِها قبل رمضان القادم."
  },
  "quran": {
    "headline": "اقرأ القرآن، بتنسيق جميل.",
    "subhead": "مصحف المدينة، بدون إنترنت."
  }
}
```

- [ ] **Step 6: Run tests to verify pass**

Run: `cd scripts/screenshots && bun run test`
Expected: all 4 tests pass.

- [ ] **Step 7: Commit**

```bash
git add scripts/screenshots/headlines.schema.ts scripts/screenshots/headlines.en.json scripts/screenshots/headlines.ar.json scripts/screenshots/__tests__/headlines.test.ts
git commit -m "feat(screenshots): add headlines schema and en/ar copy"
```

---

### Task 16: Add device-frame SVGs

**Files:**

- Create: `scripts/screenshots/frames/iphone-6.9.svg`
- Create: `scripts/screenshots/frames/iphone-6.5.svg`
- Create: `scripts/screenshots/frames/ipad-13.svg`
- Create: `scripts/screenshots/frames/android-phone.svg`

- [ ] **Step 1: Author SVGs**

Each SVG is a vector device bezel sized to the device's logical (CSS) pixel dimensions divided by `dpr`. The internal "screen" rectangle is what the captured app screenshot fills.

For each frame, the SVG contains:

- An outer rounded-rect bezel matching the device's physical look (notch/dynamic island for iPhones, even bezel for iPad/Android).
- An inner rectangle marked with `id="screen-area"` whose bounding box is where the captured screen image is positioned in the composite step.

A minimal placeholder for `iphone-6.9.svg` (replace dimensions and corner radius for each variant):

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 430 932" width="430" height="932">
  <rect x="2" y="2" width="426" height="928" rx="55" fill="#0f1115" stroke="#1d2027" stroke-width="4"/>
  <rect id="screen-area" x="14" y="14" width="402" height="904" rx="44" fill="#000"/>
  <rect x="155" y="14" width="120" height="32" rx="16" fill="#0f1115"/>
</svg>
```

Specifications:

- `iphone-6.9.svg` — viewBox `0 0 430 932`, screen rect `14 14 402 904`, dynamic island top.
- `iphone-6.5.svg` — viewBox `0 0 414 896`, screen rect `12 12 390 872`, notch top.
- `ipad-13.svg` — viewBox `0 0 1032 1376`, screen rect `24 24 984 1328`, no notch.
- `android-phone.svg` — viewBox `0 0 360 640`, screen rect `8 8 344 624`, hole-punch camera.

If you are not confident hand-authoring SVGs that look polished, replace each with a high-quality device frame from a public asset pack (e.g. https://github.com/devicons/devicon or Apple's official Marketing Resources) and commit them to the same paths — the rest of the pipeline only depends on the file existing at that path with an `id="screen-area"` rect.

- [ ] **Step 2: Verify rendering**

Run: `open scripts/screenshots/frames/iphone-6.9.svg` (macOS) — visually check the frame.

- [ ] **Step 3: Commit**

```bash
git add scripts/screenshots/frames/
git commit -m "feat(screenshots): add device-frame SVGs"
```

---

### Task 17: Add frame template (HTML + CSS)

**Files:**

- Create: `scripts/screenshots/templates/frame.html`
- Create: `scripts/screenshots/templates/frame.css`

- [ ] **Step 1: Write frame.css**

```css
:root {
  --bg-gradient: linear-gradient(160deg, #1a2540, #0c1530);
  --headline-color: #e8edf6;
  --subhead-color: rgba(232, 237, 246, 0.72);
  --headline-font: "Asap", -apple-system, BlinkMacSystemFont, sans-serif;
  --headline-font-rtl: "IBM Plex Sans Arabic", "SF Arabic", system-ui, sans-serif;
  --frame-svg: none;
  --screen-image: none;
}

html,
body {
  margin: 0;
  padding: 0;
  background: var(--bg-gradient);
  font-family: var(--headline-font);
}

html[dir="rtl"] body {
  font-family: var(--headline-font-rtl);
}

.composite {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  padding: 6vh 5vw;
  box-sizing: border-box;
}

.headline-block {
  text-align: center;
  margin-bottom: 4vh;
}

.headline {
  font-size: 6vh;
  font-weight: 700;
  color: var(--headline-color);
  line-height: 1.15;
  margin: 0 0 1.5vh 0;
  letter-spacing: -0.01em;
}

.subhead {
  font-size: 3vh;
  font-weight: 400;
  color: var(--subhead-color);
  margin: 0;
}

.device {
  flex: 1;
  width: 100%;
  position: relative;
  background-image: var(--frame-svg);
  background-repeat: no-repeat;
  background-position: center;
  background-size: contain;
}

.device .screen {
  position: absolute;
  background-image: var(--screen-image);
  background-size: cover;
  background-position: center;
  /* The capture script sets top/left/width/height in pixels via inline styles
     based on the screen-area rect read from the SVG. */
}
```

- [ ] **Step 2: Write frame.html**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <link rel="stylesheet" href="frame.css" />
  </head>
  <body>
    <div class="composite">
      <div class="headline-block">
        <h1 class="headline" id="headline"></h1>
        <p class="subhead" id="subhead"></p>
      </div>
      <div class="device">
        <div class="screen" id="screen"></div>
      </div>
    </div>
  </body>
</html>
```

- [ ] **Step 3: Commit**

```bash
git add scripts/screenshots/templates/
git commit -m "feat(screenshots): add composite frame template"
```

---

### Task 18: Implement capture script — single cell

**Files:**

- Create: `scripts/screenshots/capture.ts`

- [ ] **Step 1: Implement capture for one (size, locale, screen) cell**

```ts
// scripts/screenshots/capture.ts
import { chromium, Browser, BrowserContext, Page } from "playwright";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { DEVICE_MATRIX, LOCALES, type DeviceTarget } from "./device-matrix.ts";
import { SCREENS, type ScreenSpec } from "./screens.ts";
import { validateHeadlines, type Headlines } from "./headlines.schema.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
const STAGING_ROOT = path.join(PROJECT_ROOT, "fastlane/screenshots/staging");
const FRAMES_DIR = path.join(__dirname, "frames");
const TEMPLATE_PATH = path.join(__dirname, "templates/frame.html");
const BASE_URL = process.env.PREVIEW_BASE_URL ?? "http://localhost:8081";

async function loadHeadlines(locale: "en" | "ar"): Promise<Headlines> {
  const raw = await fs.readFile(path.join(__dirname, `headlines.${locale}.json`), "utf8");
  return validateHeadlines(JSON.parse(raw));
}

async function captureInner(
  context: BrowserContext,
  device: DeviceTarget,
  locale: "en" | "ar",
  screen: ScreenSpec
): Promise<Buffer> {
  const page = await context.newPage();
  const url = `${BASE_URL}/(preview)/${screen.id}?locale=${locale}&theme=dark&screenshot=true`;
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("body[data-screenshot-ready='true']", { timeout: 15000 });
  const buf = await page.screenshot({ fullPage: false, type: "png" });
  await page.close();
  return buf;
}

async function readScreenAreaRect(framePath: string) {
  const svg = await fs.readFile(framePath, "utf8");
  const m = svg.match(
    /id="screen-area"[^>]*x="([^"]+)"[^>]*y="([^"]+)"[^>]*width="([^"]+)"[^>]*height="([^"]+)"/
  );
  if (!m) throw new Error(`screen-area rect not found in ${framePath}`);
  const [, x, y, w, h] = m;
  const viewBox = svg.match(/viewBox="([^"]+)"/);
  if (!viewBox) throw new Error(`viewBox missing in ${framePath}`);
  const [, , , vbW, vbH] = viewBox[1].split(/\s+/).map(Number);
  return { x: +x / vbW, y: +y / vbH, w: +w / vbW, h: +h / vbH };
}

async function compositeFrame(
  context: BrowserContext,
  device: DeviceTarget,
  locale: "en" | "ar",
  innerPng: Buffer,
  headline: string,
  subhead: string
): Promise<Buffer> {
  const framePath = path.join(FRAMES_DIR, device.frame);
  const rect = await readScreenAreaRect(framePath);
  const innerDataUrl = `data:image/png;base64,${innerPng.toString("base64")}`;
  const frameDataUrl = `${pathToFileURL(framePath).toString()}`;
  const dir: "ltr" | "rtl" = locale === "ar" || locale === "ur" ? "rtl" : "ltr";

  const page = await context.newPage();
  await page.setViewportSize({
    width: device.width / device.dpr,
    height: device.height / device.dpr,
  });
  await page.goto(pathToFileURL(TEMPLATE_PATH).toString(), { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ({ rect, innerDataUrl, frameDataUrl, headline, subhead, dir }) => {
      document.documentElement.setAttribute("dir", dir);
      const root = document.documentElement.style;
      root.setProperty("--screen-image", `url("${innerDataUrl}")`);
      root.setProperty("--frame-svg", `url("${frameDataUrl}")`);
      (document.getElementById("headline") as HTMLElement).textContent = headline;
      (document.getElementById("subhead") as HTMLElement).textContent = subhead;
      const device = document.querySelector(".device") as HTMLElement;
      const w = device.clientWidth;
      const h = device.clientHeight;
      const screen = document.getElementById("screen") as HTMLElement;
      screen.style.left = `${rect.x * w}px`;
      screen.style.top = `${rect.y * h}px`;
      screen.style.width = `${rect.w * w}px`;
      screen.style.height = `${rect.h * h}px`;
    },
    { rect, innerDataUrl, frameDataUrl, headline, subhead, dir }
  );
  await page.evaluate(() => document.fonts.ready);
  const buf = await page.screenshot({ fullPage: false, type: "png" });
  await page.close();
  return buf;
}

export async function captureCell(
  browser: Browser,
  device: DeviceTarget,
  locale: "en" | "ar",
  screen: ScreenSpec,
  headlines: Headlines
): Promise<string> {
  const innerCtx = await browser.newContext({
    viewport: { width: device.width / device.dpr, height: device.height / device.dpr },
    deviceScaleFactor: device.dpr,
  });
  const inner = await captureInner(innerCtx, device, locale, screen);
  await innerCtx.close();

  const compositeCtx = await browser.newContext({
    viewport: { width: device.width / device.dpr, height: device.height / device.dpr },
    deviceScaleFactor: device.dpr,
  });
  const entry = headlines[screen.id];
  if (!entry) throw new Error(`No headline for ${screen.id} in ${locale}`);
  const composite = await compositeFrame(
    compositeCtx,
    device,
    locale,
    inner,
    entry.headline,
    entry.subhead
  );
  await compositeCtx.close();

  const outDir = path.join(STAGING_ROOT, device.store, locale, device.id);
  await fs.mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, `${String(screen.slot).padStart(2, "0")}-${screen.id}.png`);
  await fs.writeFile(outPath, composite);
  return outPath;
}

async function main() {
  const single = process.env.SCREENSHOTS_SINGLE === "1";
  const browser = await chromium.launch();
  try {
    if (single) {
      const headlines = await loadHeadlines("en");
      const out = await captureCell(browser, DEVICE_MATRIX[0], "en", SCREENS[0], headlines);
      console.log("Wrote", out);
      return;
    }
    for (const locale of LOCALES) {
      const headlines = await loadHeadlines(locale);
      for (const device of DEVICE_MATRIX) {
        for (const screen of SCREENS) {
          const out = await captureCell(browser, device, locale, screen, headlines);
          console.log("Wrote", out);
        }
      }
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Smoke test single-cell mode**

Open a separate terminal and run `bun start --web` (so the preview server is reachable). Wait for it to be ready.

Then in another terminal:

```bash
cd scripts/screenshots
SCREENSHOTS_SINGLE=1 bun run capture.ts
```

Expected: writes one PNG to `fastlane/screenshots/staging/ios/en/iphone-6.9/01-prayer-times.png`. Open it and verify it shows the prayer-times screen inside an iPhone 6.9 frame with the "Accurate prayer times, anywhere." headline.

If the output looks broken, the most likely causes (in order): preview server not actually serving the route, font not loaded before screenshot, screen-area SVG rect mismatched. Inspect the HTML in DevTools first by adding `await page.pause()` after the `evaluate` call.

- [ ] **Step 3: Commit**

```bash
git add scripts/screenshots/capture.ts
git commit -m "feat(screenshots): implement Playwright capture pipeline"
```

---

### Task 19: Implement post-processing script

**Files:**

- Create: `scripts/screenshots/post.ts`
- Create: `scripts/screenshots/__tests__/post.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// scripts/screenshots/__tests__/post.test.ts
import { describe, it, expect } from "vitest";
import { computeTargetPath } from "../post.ts";

describe("computeTargetPath", () => {
  it("maps an iOS staging path to deliver layout", () => {
    expect(
      computeTargetPath({
        store: "ios",
        locale: "en",
        sizeId: "iphone-6.9",
        slot: 1,
        screenId: "prayer-times",
      })
    ).toBe("fastlane/screenshots/ios/en-US/01_iphone-6.9_prayer-times.png");
  });

  it("maps Arabic to ar-SA on iOS", () => {
    expect(
      computeTargetPath({
        store: "ios",
        locale: "ar",
        sizeId: "iphone-6.9",
        slot: 1,
        screenId: "prayer-times",
      })
    ).toBe("fastlane/screenshots/ios/ar-SA/01_iphone-6.9_prayer-times.png");
  });

  it("maps an Android phone path to supply layout", () => {
    expect(
      computeTargetPath({
        store: "android",
        locale: "en",
        sizeId: "android-phone",
        slot: 3,
        screenId: "athkar",
      })
    ).toBe("fastlane/metadata/android/en-US/images/phoneScreenshots/03_athkar.png");
  });

  it("maps Arabic to ar on Android", () => {
    expect(
      computeTargetPath({
        store: "android",
        locale: "ar",
        sizeId: "android-phone",
        slot: 3,
        screenId: "athkar",
      })
    ).toBe("fastlane/metadata/android/ar/images/phoneScreenshots/03_athkar.png");
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `cd scripts/screenshots && bun run test`
Expected: FAIL — `post.ts` doesn't export `computeTargetPath`.

- [ ] **Step 3: Implement post.ts**

```ts
// scripts/screenshots/post.ts
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEVICE_MATRIX, LOCALES } from "./device-matrix.ts";
import { SCREENS } from "./screens.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
const STAGING_ROOT = path.join(PROJECT_ROOT, "fastlane/screenshots/staging");

const IOS_LOCALE: Record<"en" | "ar", string> = { en: "en-US", ar: "ar-SA" };
const ANDROID_LOCALE: Record<"en" | "ar", string> = { en: "en-US", ar: "ar" };

export type TargetArgs = {
  store: "ios" | "android";
  locale: "en" | "ar";
  sizeId: string;
  slot: number;
  screenId: string;
};

export function computeTargetPath(args: TargetArgs): string {
  const slot = String(args.slot).padStart(2, "0");
  if (args.store === "ios") {
    const locale = IOS_LOCALE[args.locale];
    return `fastlane/screenshots/ios/${locale}/${slot}_${args.sizeId}_${args.screenId}.png`;
  }
  const locale = ANDROID_LOCALE[args.locale];
  return `fastlane/metadata/android/${locale}/images/phoneScreenshots/${slot}_${args.screenId}.png`;
}

async function copyAll() {
  for (const locale of LOCALES) {
    for (const device of DEVICE_MATRIX) {
      for (const screen of SCREENS) {
        const stagingPath = path.join(
          STAGING_ROOT,
          device.store,
          locale,
          device.id,
          `${String(screen.slot).padStart(2, "0")}-${screen.id}.png`
        );
        try {
          await fs.access(stagingPath);
        } catch {
          continue;
        }
        // Android only ships phone screenshots from one device class; skip
        // other Android sizes if they exist.
        if (device.store === "android" && device.id !== "android-phone") continue;
        const targetRel = computeTargetPath({
          store: device.store,
          locale,
          sizeId: device.id,
          slot: screen.slot,
          screenId: screen.id,
        });
        const targetAbs = path.join(PROJECT_ROOT, targetRel);
        await fs.mkdir(path.dirname(targetAbs), { recursive: true });
        await fs.copyFile(stagingPath, targetAbs);
        console.log("→", targetRel);
      }
    }
  }
}

const isMain = import.meta.url === pathToFileURLString(process.argv[1]);

function pathToFileURLString(p: string): string {
  return new URL(`file://${path.resolve(p)}`).toString();
}

if (isMain) {
  copyAll().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `cd scripts/screenshots && bun run test`
Expected: 4 passing tests.

- [ ] **Step 5: Run end-to-end against staging**

After Task 18 has produced staging output, run:

```bash
cd scripts/screenshots && bun run post.ts
```

Expected: PNGs appear in `fastlane/screenshots/ios/en-US/` and `fastlane/metadata/android/en-US/images/phoneScreenshots/`. Run `ls -1 fastlane/screenshots/ios/en-US/` and confirm filenames include the size suffix and slot prefix.

- [ ] **Step 6: Commit**

```bash
git add scripts/screenshots/post.ts scripts/screenshots/__tests__/post.test.ts
git commit -m "feat(screenshots): post-process staging into per-store layouts"
```

---

### Task 20: Wire root npm scripts

**Files:**

- Modify: `package.json` (root)

- [ ] **Step 1: Inspect existing scripts**

Run: `grep '"scripts"' -A 30 package.json | head -40`

- [ ] **Step 2: Add screenshot scripts**

Add the following to `scripts` in `package.json`:

```json
"screenshots:web": "expo start --web",
"screenshots:capture": "tsx scripts/screenshots/capture.ts",
"screenshots:capture:single": "SCREENSHOTS_SINGLE=1 tsx scripts/screenshots/capture.ts",
"screenshots:post": "tsx scripts/screenshots/post.ts",
"screenshots:full": "concurrently -k -s first 'bun run screenshots:web' 'wait-on http-get://localhost:8081 && bun run screenshots:capture && bun run screenshots:post'"
```

- [ ] **Step 3: Add concurrently + wait-on as dev deps**

Run: `bun add -D concurrently wait-on`

- [ ] **Step 4: Smoke test the orchestrator**

Run: `bun run screenshots:full`
Expected: web server starts, capture runs against all 56 cells, post copies to fastlane folders, then web server is killed cleanly. Output should end with "→ fastlane/..." lines.

- [ ] **Step 5: Commit**

```bash
git add package.json bun.lock
git commit -m "feat(screenshots): wire root npm orchestration scripts"
```

---

### Task 21: Verify fastlane lanes consume the output

**Files:** none modified — verification.

- [ ] **Step 1: Confirm iOS lane sees screenshots**

Pre-req: ASC API key already in place (M4 manual step). If not, skip to Step 3.

Run: `cd fastlane && fastlane ios update_screenshots`
Expected: deliver picks up the PNGs from `fastlane/screenshots/ios/{en-US,ar-SA}/` and uploads them to App Store Connect.

- [ ] **Step 2: Confirm Android lane sees screenshots**

Run: `cd fastlane && fastlane android update_listing`
Expected: supply uploads PNGs from `fastlane/metadata/android/{en-US,ar}/images/phoneScreenshots/` to the Play Console.

- [ ] **Step 3: Document the workflow**

Update `fastlane/README.md` (or create `docs/store-screenshots-workflow.md`) with a 5-line section explaining:

1. To regenerate screenshots: `bun run screenshots:full`.
2. To upload iOS: `cd fastlane && fastlane ios update_screenshots`.
3. To upload Android: `cd fastlane && fastlane android update_listing`.
4. Pre-req: `fastlane/.env` populated and `fastlane/AuthKey_*.p8` present.
5. Iterating on copy: edit `scripts/screenshots/headlines.{en,ar}.json`, rerun the full workflow.

- [ ] **Step 4: Commit**

```bash
git add fastlane/README.md docs/store-screenshots-workflow.md 2>/dev/null
git commit -m "docs(screenshots): document end-to-end refresh workflow"
```

---

## Self-Review

The plan covers each spec section:

- Decision matrix → implicit in device-matrix.ts (Task 13), screens.ts (Task 14), headlines (Task 15), iOS scaffold already in `1fe9c89`.
- M1 web preview harness → Tasks 2–11.
- M2 Playwright pipeline → Tasks 12–20.
- M3 Android wiring → Task 21 verifies; nothing further.
- M4 iOS wiring → Task 21 verifies; ASC key generation is the user's manual prerequisite (already tracked separately).
- Build sequence (M1 first, then one-cell M2, then matrix) → Phase 1 / Phase 2 / Tasks 18 (single cell) → 20 (full orchestrator).
- Out-of-scope items (ms/ur, CI, tablets, simulator capture, EAS-binary changes) — not present in any task ✓.

Type consistency: `DeviceTarget`, `ScreenSpec`, `Headlines`, `TargetArgs` reused identically across capture.ts and post.ts. Locale codes used: `"en" | "ar"` as the canonical input keys; `IOS_LOCALE` / `ANDROID_LOCALE` maps in post.ts handle the ASC and Play locale code expansion. Nothing references a name not defined.

No `TBD`/`fill in`/`similar to Task N` placeholders.
