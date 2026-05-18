import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEVICE_MATRIX, type DeviceSpec } from "./device-matrix.ts";
import { renderVariant, closeBrowser } from "./render-variant.ts";
import { HEADLINE_KEYS } from "./headlines.schema.ts";

type ScreenKey = (typeof HEADLINE_KEYS)[number];
type TargetPlatform = "ios" | "android";

type PlatformConfig = {
  deviceId: DeviceSpec["id"];
  bootFlow: string;
  shotFlow: string;
  // Resolves a booted device serial/udid Maestro can target via `--device`.
  resolveTarget: () => string;
  // Resolves the fastlane output file path for a composited cell.
  outPath: (opts: {
    locale: "en" | "ar";
    deviceId: string;
    idx: string;
    screen: ScreenKey;
    variant: "hero" | "athkar";
  }) => string;
};

const DEFAULT_SEED: Record<ScreenKey, string> = {
  "prayer-times": "makkah-dhuhr-2h14m",
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

function getBootedAndroidSerial(): string {
  const output = shOut("adb", ["devices"]);
  // `adb devices` prints a header line then `<serial>\t<state>` rows.
  for (const line of output.split("\n").slice(1)) {
    const [serial, state] = line.trim().split(/\s+/);
    if (serial && state === "device") {
      console.log(`[verify] using running android device: ${serial}`);
      return serial;
    }
  }
  throw new Error(
    "No running Android device/emulator found. Start one with `emulator -avd <name>` or connect a device."
  );
}

// iOS: en → en-US, ar → ar-SA (App Store locale dirs).
const IOS_LOCALE_DIR: Record<"en" | "ar", string> = { en: "en-US", ar: "ar-SA" };
// Android/Play: dirs verified on disk at fastlane/metadata/android (en-US, ar).
const ANDROID_PLAY_LOCALE: Record<"en" | "ar", string> = { en: "en-US", ar: "ar" };

function platformConfig(platform: TargetPlatform): PlatformConfig {
  if (platform === "android") {
    return {
      deviceId: "android-phone",
      bootFlow: "boot.android.yaml",
      shotFlow: "shot.android.yaml",
      resolveTarget: getBootedAndroidSerial,
      outPath: ({ locale, idx, screen, variant }) => {
        const playLocale = ANDROID_PLAY_LOCALE[locale];
        const dir = path.join(
          PROJECT_ROOT,
          "fastlane",
          "metadata",
          "android",
          playLocale,
          "images",
          "phoneScreenshots"
        );
        const name = variant === "athkar" ? "03-athkar-bilingual.png" : `${idx}-${screen}.png`;
        return path.join(dir, name);
      },
    };
  }
  return {
    deviceId: "iphone-6.9",
    bootFlow: "boot.yaml",
    shotFlow: "shot.yaml",
    resolveTarget: getBootedDeviceId,
    outPath: ({ locale, deviceId, idx, screen, variant }) => {
      const dir = path.join(OUT_DIR, "ios", IOS_LOCALE_DIR[locale], deviceId);
      const name = variant === "athkar" ? "03-athkar-bilingual.png" : `${idx}-${screen}.png`;
      return path.join(dir, name);
    },
  };
}

function captureRaw(opts: {
  screen: ScreenKey;
  locale: "en" | "ar";
  seed: string;
  deviceId: string;
  bootedUdid: string;
  platform: TargetPlatform;
}): Buffer {
  const { screen, locale, seed, deviceId, bootedUdid, platform } = opts;
  const cfg = platformConfig(platform);
  const rawDir = path.join(RAW_DIR, platform, locale, deviceId);
  mkdirSync(rawDir, { recursive: true });
  const idx = String(SCREEN_INDEX[screen]).padStart(2, "0");
  // Maestro appends `.png` to whatever path it gets. Pass the stem; read back with extension.
  const rawPathStem = path.join(rawDir, `${idx}-${screen}`);
  const rawPath = `${rawPathStem}.png`;

  const url = `myapp://screenshot/${screen}?locale=${locale}&seed=${seed}`;
  const flowPath = path.join(SCRIPT_DIR, "flows", cfg.shotFlow);
  const readyId = `shot-ready-${screen}-${locale}`;

  console.log(`[capture] ${locale} → ${url}`);
  sh("maestro", [
    "--device",
    bootedUdid,
    "test",
    "-e",
    `SCREENSHOT_URL=${url}`,
    "-e",
    `OUT_PATH=${rawPathStem}`,
    "-e",
    `READY_ID=${readyId}`,
    flowPath,
  ]);

  if (!existsSync(rawPath)) {
    throw new Error(`Maestro did not produce ${rawPath} — check the flow output above`);
  }
  console.log(`[capture] raw captured: ${rawPath}`);
  return readFileSync(rawPath);
}

function bootApp(bootedUdid: string, platform: TargetPlatform): void {
  const flowPath = path.join(SCRIPT_DIR, "flows", platformConfig(platform).bootFlow);
  console.log(`[boot] cold-launching app once on ${bootedUdid}`);
  sh("maestro", ["--device", bootedUdid, "test", flowPath]);
}

// Capture + composite one cell. Assumes the app is already running (bootApp
// was called once for the whole batch); fires a deep link into the live
// session rather than relaunching.
async function captureCell(opts: {
  screen: ScreenKey;
  locale: "en" | "ar";
  seed?: string;
  device?: string;
  variant?: "hero" | "athkar";
  bootedUdid: string;
  platform: TargetPlatform;
}) {
  const { screen, locale, bootedUdid, platform } = opts;
  const cfg = platformConfig(platform);
  const variant = opts.variant ?? "hero";
  const seed = opts.seed ?? DEFAULT_SEED[screen];
  const deviceId = opts.device ?? cfg.deviceId;

  const device = DEVICE_MATRIX.find((d) => d.id === deviceId);
  if (!device) throw new Error(`Unknown device: ${deviceId}`);

  const idx = String(SCREEN_INDEX[screen]).padStart(2, "0");

  let out: Buffer;
  if (variant === "athkar") {
    // Bilingual variant: capture en + ar then composite both into one canvas.
    const enRaw = captureRaw({ screen, locale: "en", seed, deviceId, bootedUdid, platform });
    const arRaw = captureRaw({ screen, locale: "ar", seed, deviceId, bootedUdid, platform });
    out = await renderVariant({
      rawPngs: { en: enRaw, ar: arRaw },
      screen,
      device,
      locale,
      variant: "athkar",
    });
  } else {
    const raw = captureRaw({ screen, locale, seed, deviceId, bootedUdid, platform });
    out = await renderVariant({ rawPng: raw, screen, device, locale, variant: "hero" });
  }

  const outPath = cfg.outPath({ locale, deviceId: device.id, idx, screen, variant });
  mkdirSync(path.dirname(outPath), { recursive: true });
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

// The review-ready matrix: every cell shares one app session (one cold boot).
const ALL_CELLS: { screen: ScreenKey; locale: "en" | "ar"; variant: "hero" | "athkar" }[] = [
  { screen: "prayer-times", locale: "en", variant: "hero" },
  { screen: "prayer-times", locale: "ar", variant: "hero" },
  { screen: "athkar", locale: "en", variant: "athkar" },
  { screen: "athkar", locale: "ar", variant: "athkar" },
  { screen: "qibla", locale: "en", variant: "hero" },
  { screen: "qibla", locale: "ar", variant: "hero" },
  { screen: "qada", locale: "en", variant: "hero" },
  { screen: "qada", locale: "ar", variant: "hero" },
  { screen: "athkar-with-audio", locale: "en", variant: "hero" },
  { screen: "athkar-with-audio", locale: "ar", variant: "hero" },
];

if (import.meta.main) {
  const cmd = process.argv[2];
  const flags = parseFlags();
  const platform = (flags.platform ?? "ios") as TargetPlatform;
  if (platform !== "ios" && platform !== "android") {
    console.error(`Unknown platform: ${platform}. Valid: ios, android`);
    process.exit(2);
  }
  if (cmd === "verify") {
    const screen = (flags.screen ?? "prayer-times") as ScreenKey;
    const locale = (flags.locale ?? "en") as "en" | "ar";
    if (!HEADLINE_KEYS.includes(screen)) {
      console.error(`Unknown screen: ${screen}. Valid: ${HEADLINE_KEYS.join(", ")}`);
      process.exit(2);
    }
    const variant = (flags.variant ?? "hero") as "hero" | "athkar";
    if (variant !== "hero" && variant !== "athkar") {
      console.error(`Unknown variant: ${variant}. Valid: hero, athkar`);
      process.exit(2);
    }
    (async () => {
      const bootedUdid = platformConfig(platform).resolveTarget();
      bootApp(bootedUdid, platform);
      await captureCell({
        screen,
        locale,
        seed: flags.seed,
        device: flags.device,
        variant,
        bootedUdid,
        platform,
      });
      await closeBrowser();
    })().catch((e) => {
      console.error(e);
      process.exit(1);
    });
  } else if (cmd === "all") {
    (async () => {
      const bootedUdid = platformConfig(platform).resolveTarget();
      bootApp(bootedUdid, platform);
      const failures: string[] = [];
      for (const cell of ALL_CELLS) {
        try {
          await captureCell({ ...cell, device: flags.device, bootedUdid, platform });
        } catch (e) {
          console.error(`[all] FAILED ${cell.screen}/${cell.locale}:`, e);
          failures.push(`${cell.screen}/${cell.locale}`);
        }
      }
      await closeBrowser();
      if (failures.length) {
        console.error(`\n[all] ${failures.length} cell(s) failed: ${failures.join(", ")}`);
        process.exit(1);
      }
      console.log(`\n[all] ${ALL_CELLS.length} cells composited successfully.`);
    })().catch((e) => {
      console.error(e);
      process.exit(1);
    });
  } else {
    console.log(
      "Usage:\n" +
        "  bun run.ts verify [--platform=ios|android] [--screen=<key>] [--locale=en|ar] [--variant=hero|athkar] [--seed=<key>]\n" +
        "  bun run.ts all [--platform=ios|android]   — full review-ready matrix in one app session"
    );
    process.exit(2);
  }
}
