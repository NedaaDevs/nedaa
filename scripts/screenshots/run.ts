import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEVICE_MATRIX } from "./device-matrix.ts";
import { renderVariant, closeBrowser } from "./render-variant.ts";
import { HEADLINE_KEYS } from "./headlines.schema.ts";

type ScreenKey = (typeof HEADLINE_KEYS)[number];

const DEFAULT_SEED: Record<ScreenKey, string> = {
  "prayer-times": "madinah-dhuhr-2h14m",
  "reliable-alarms": "fajr-madinah-ringing",
  athkar: "morning-3-of-10",
  qibla: "istanbul-pointing-141",
  privacy: "default",
  qada: "missed-3-2-4-1-2",
  quran: "al-fatiha-page-1",
  "athkar-with-audio": "track-2-at-1m14s",
  "widgets-1": "default",
  "widgets-2": "default",
};

const SCREEN_INDEX: Record<ScreenKey, number> = {
  "prayer-times": 1,
  "reliable-alarms": 2,
  athkar: 3,
  qibla: 4,
  privacy: 5,
  qada: 6,
  quran: 7,
  "athkar-with-audio": 8,
  "widgets-1": 9,
  "widgets-2": 10,
};

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, "..", "..");
const RAW_DIR = path.join(PROJECT_ROOT, "tmp", "screenshots-raw");
const OUT_DIR = path.join(PROJECT_ROOT, "fastlane", "screenshots");

function sh(cmd: string, args: string[]): void {
  execFileSync(cmd, args, { stdio: "inherit" });
}

function shOut(cmd: string, args: string[]): string {
  return execFileSync(cmd, args, { encoding: "utf8" });
}

function getBootedDeviceId(): string {
  const output = shOut("xcrun", ["simctl", "list", "devices", "booted", "-j"]);
  const data = JSON.parse(output) as {
    devices: Record<string, { udid: string; name: string; state: string }[]>;
  };
  for (const runtime of Object.keys(data.devices)) {
    for (const dev of data.devices[runtime]) {
      if (dev.state === "Booted") {
        console.log(`[verify] using booted simulator: ${dev.name} (${dev.udid})`);
        return dev.udid;
      }
    }
  }
  throw new Error(
    "No booted iOS simulator found. Boot one with `xcrun simctl boot <UDID>` or open Simulator.app."
  );
}

async function verifyCell(opts: {
  screen: ScreenKey;
  locale: "en" | "ar";
  seed?: string;
  device?: string;
}) {
  const { screen, locale } = opts;
  const seed = opts.seed ?? DEFAULT_SEED[screen];
  const deviceId = opts.device ?? "iphone-6.9";

  const device = DEVICE_MATRIX.find((d) => d.id === deviceId);
  if (!device) throw new Error(`Unknown device: ${deviceId}`);

  const bootedUdid = getBootedDeviceId();

  const platform = "ios";
  const rawDir = path.join(RAW_DIR, platform, locale, device.id);
  mkdirSync(rawDir, { recursive: true });
  const idx = String(SCREEN_INDEX[screen]).padStart(2, "0");
  // Maestro appends `.png` to whatever path it gets. Pass the stem; read back with extension.
  const rawPathStem = path.join(rawDir, `${idx}-${screen}`);
  const rawPath = `${rawPathStem}.png`;

  const url = `myapp://screenshot/${screen}?locale=${locale}&seed=${seed}`;
  const flowPath = path.join(SCRIPT_DIR, "flows", "single-screen.yaml");

  console.log(`[verify] firing Maestro flow → ${url}`);
  sh("maestro", [
    "--device",
    bootedUdid,
    "test",
    "-e",
    `SCREENSHOT_URL=${url}`,
    "-e",
    `OUT_PATH=${rawPathStem}`,
    flowPath,
  ]);

  if (!existsSync(rawPath)) {
    throw new Error(`Maestro did not produce ${rawPath} — check the flow output above`);
  }
  console.log(`[verify] raw captured: ${rawPath}`);

  const out = await renderVariant({
    rawPng: readFileSync(rawPath),
    screen,
    device,
    locale,
    variant: "hero",
  });
  await closeBrowser();

  const localeFull = locale === "en" ? "en-US" : "ar-SA";
  const outDir = path.join(OUT_DIR, platform, localeFull, device.id);
  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${idx}-${screen}.png`);
  writeFileSync(outPath, out);

  console.log(`\n✓ Verification cell produced:\n  ${outPath}\n`);
  console.log(`Open it (\`open ${outPath}\`) and approve visually before proceeding.\n`);
}

function parseFlags(): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 3; i < process.argv.length; i++) {
    const m = process.argv[i].match(/^--(\w[\w-]*)=(.+)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

if (import.meta.main) {
  const cmd = process.argv[2];
  const flags = parseFlags();
  if (cmd === "verify") {
    const screen = (flags.screen ?? "prayer-times") as ScreenKey;
    const locale = (flags.locale ?? "en") as "en" | "ar";
    if (!HEADLINE_KEYS.includes(screen)) {
      console.error(`Unknown screen: ${screen}. Valid: ${HEADLINE_KEYS.join(", ")}`);
      process.exit(2);
    }
    verifyCell({ screen, locale, seed: flags.seed, device: flags.device }).catch((e) => {
      console.error(e);
      process.exit(1);
    });
  } else {
    console.log("Usage: bun run.ts verify [--screen=<key>] [--locale=en|ar] [--seed=<key>]");
    process.exit(2);
  }
}
