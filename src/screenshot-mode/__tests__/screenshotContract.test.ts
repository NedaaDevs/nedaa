import { execFileSync } from "child_process";
import { readFileSync } from "fs";
import { join } from "path";

const SRC = join(__dirname, "../..");
const read = (relative: string) => readFileSync(join(SRC, relative), "utf8");

/** The declared keys, read from the union rather than retyped. */
const declaredKeys = (): string[] => {
  const union = read("stores/screenshotStore.ts").match(
    /export type ScreenshotScreenKey =([\s\S]*?);/
  );
  if (!union) throw new Error("ScreenshotScreenKey union not found");
  return [...union[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
};

const routedKeys = (): string[] => {
  const map = read("screenshot-mode/router.ts").match(
    /SCREEN_TO_PATH: Record<ScreenshotScreenKey, string> = \{([\s\S]*?)\n\};/
  );
  if (!map) throw new Error("SCREEN_TO_PATH not found");
  return [...map[1].matchAll(/^\s*"?([a-z-]+)"?:/gm)].map((m) => m[1]);
};

/** Keys some component actually reads a seed for. */
const consumedKeys = (): string[] => {
  const out = execFileSync(
    "grep",
    ["-rhoE", 'useScreenshotSeed\\("[^"]+"\\)', SRC, "--include=*.ts", "--include=*.tsx"],
    { encoding: "utf8" }
  );
  return [...new Set([...out.matchAll(/"([^"]+)"/g)].map((m) => m[1]))];
};

/**
 * Keys whose preset is defined but read by nothing, so the capture shows live data.
 * A ratchet, not an allowance: this list may shrink, never grow.
 */
const KNOWN_ORPHANS = ["reliable-alarms", "privacy", "tools"];

describe("screenshot contract", () => {
  // A key with no consumer captures LIVE data in place of the preset — the shot
  // succeeds and the content is wrong, which is how 2.10.1 was rejected.
  it("orphans no key that a component reads today", () => {
    const consumed = consumedKeys();
    const orphaned = declaredKeys().filter((key) => !consumed.includes(key));

    expect(orphaned.sort()).toEqual([...KNOWN_ORPHANS].sort());
  });

  it("every declared key has a route", () => {
    const routed = routedKeys();
    const unrouted = declaredKeys().filter((key) => !routed.includes(key));

    expect(unrouted).toEqual([]);
  });

  it("no route points at a key that no longer exists", () => {
    const declared = declaredKeys();
    const stale = routedKeys().filter((key) => !declared.includes(key));

    expect(stale).toEqual([]);
  });
});
