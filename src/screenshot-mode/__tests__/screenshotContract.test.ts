import { readFileSync } from "node:fs";
import { sep } from "node:path";

import {
  SCREENSHOT_SCREENS,
  STATIC_SCREENSHOT_SCREENS,
  type ScreenshotScreenKey,
} from "@/constants/Screenshot";
import { readRoutes, resolvesToRoute, walkFiles, ROUTES_DIR } from "@/test-helpers/routeTree";
import { getPreset, presets } from "@/screenshot-mode/presets";
import { SCREEN_TO_PATH } from "@/screenshot-mode/screenPaths";

/**
 * Pins what the types cannot: that a key's path reaches a route file, and that
 * something reads its preset. Both fail silently, capturing the wrong screen or
 * live data. Key presence is already a compile error, so nothing restates it.
 */

const SRC = ROUTES_DIR.split(sep).slice(0, -1).join(sep);

/** `presets` is a mapped type over the key union, so its keys are the declared set. */
const declaredKeys = Object.keys(presets);

/** Both consumer forms: the hook during render, the selector outside React. */
const SEED_CONSUMER = /(?:use|select)ScreenshotSeed(?:<[^>]*>)?\([^)]*?"([^"]+)"/g;

const consumedKeys = (): string[] => {
  const files = walkFiles(SRC).filter(
    (path) => /\.tsx?$/.test(path) && !path.split(sep).includes("__tests__")
  );
  const keys = files
    .flatMap((path) => [...readFileSync(path, "utf8").matchAll(SEED_CONSUMER)])
    .map((match) => match[1]);
  return [...new Set(keys)];
};

/**
 * Keys no component reads a seed for, and why. Each reason is re-proved below, so
 * an entry suppresses nothing — it moves the proof to another assertion.
 */
const SEEDLESS_SCREENS: Record<string, string> = {
  "reliable-alarms":
    "The router consumes it: it reads ringingPrayer off the payload and passes it as the alarmType param, so the screen shows a real Fajr title rather than the CUSTOM fallback.",
  tools:
    "The Tools menu is static content. Its preset exists only so the router's getPreset() guard returns non-null and navigation proceeds.",
  "prayer-times":
    "Today reads the screenshot clock, which holds one moment app-wide in a screenshot build (useTodayClock.test pins it), so the preset only names the shot.",
  ...Object.fromEntries(
    STATIC_SCREENSHOT_SCREENS.map((key) => [
      key,
      "A settings screen shows saved preferences only; its preset exists so the router's getPreset() guard passes.",
    ])
  ),
};

const DEFAULT_SEED = "default";

const SEEDLESS_KEYS = SCREENSHOT_SCREENS.filter(
  (key: ScreenshotScreenKey) => key in SEEDLESS_SCREENS
);

describe("screenshot contract", () => {
  it("finds the seed consumers and the route tree", () => {
    // A moved directory or a regex matching nothing would pass everything below.
    expect(consumedKeys().length).toBeGreaterThan(5);
    expect(readRoutes().length).toBeGreaterThan(20);
    expect(declaredKeys).toContain("prayer-times");
  });

  // A key nothing reads captures live data: the shot succeeds, the content is wrong.
  it("gives every declared key a consumer", () => {
    const consumed = consumedKeys();
    const orphaned = declaredKeys.filter((key) => !consumed.includes(key));

    expect(orphaned.sort()).toEqual(Object.keys(SEEDLESS_SCREENS).sort());
  });

  // An unresolved path lands on +not-found, so the shot is of an error screen.
  it("points every key at a route that exists", () => {
    const routes = readRoutes();
    const unreachable = Object.entries(SCREEN_TO_PATH)
      .filter(([, path]) => !resolvesToRoute(routes, path))
      .map(([key, path]) => `${key} -> ${path}`);

    expect(unreachable).toEqual([]);
  });

  it("re-proves the router's own read of the reliable-alarms seed", () => {
    const router = readFileSync(`${SRC}/screenshot-mode/router.ts`, "utf8");

    expect(router).toContain("ringingPrayer");
    expect(router).toContain('link.screen === "reliable-alarms"');
  });

  // The router navigates only when the link's seed names a preset.
  it("gives every seedless screen a preset the router accepts", () => {
    const rejected = SEEDLESS_KEYS.filter(
      (key) => !Object.keys(presets[key]).some((seed) => getPreset(key, seed) !== null)
    );

    expect(rejected).toEqual([]);
  });

  it("carries no data in a settings screen's preset", () => {
    for (const key of STATIC_SCREENSHOT_SCREENS) {
      expect(getPreset(key, DEFAULT_SEED)).toEqual({});
    }
  });
});
