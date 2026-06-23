import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEVICE_MATRIX, type DeviceSpec } from "./device-matrix.ts";
import { renderVariant, closeBrowser } from "./render-variant.ts";
import { renderFeatureGraphic } from "./feature-graphic.ts";
import {
  SCREEN_KEYS,
  fileStem,
  planFor,
  type PlanCell,
  type ScreenKey,
  type TargetPlatform,
  type Variant,
} from "./screenshot-plan.ts";

type PlatformConfig = {
  deviceId: DeviceSpec["id"];
  bootFlow: string;
  shotFlow: string;
  // Resolves a booted device serial/udid Maestro can target via `--device`.
  resolveTarget: () => string;
  // fastlane output path for a composited store cell, named `NN-screen.png`.
  outPath: (opts: { locale: "en" | "ar"; deviceId: string; stem: string }) => string;
  // Play feature graphic output path (Android only; throws on iOS).
  featurePath: (locale: "en" | "ar") => string;
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
  tools: "default",
  umrah: "sai-2-of-4",
};

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, "..", "..");
const RAW_DIR = path.join(PROJECT_ROOT, "tmp", "screenshots-raw");
const OUT_DIR = path.join(PROJECT_ROOT, "fastlane", "screenshots");
const WEBSITE_DIR = path.join(PROJECT_ROOT, "website-v2", "src", "assets", "screenshots");

function sh(cmd: string, args: string[]): void {
  execFileSync(cmd, args, { stdio: "inherit" });
}

// Run a noisy command quietly; only surface its output if it fails. Keeps the
// per-cell progress log readable instead of drowning it in Maestro chatter.
function shQuiet(cmd: string, args: string[]): void {
  try {
    execFileSync(cmd, args, { stdio: "pipe" });
  } catch (e) {
    const err = e as { stdout?: Buffer; stderr?: Buffer };
    if (err.stdout) process.stdout.write(err.stdout);
    if (err.stderr) process.stderr.write(err.stderr);
    throw e;
  }
}

function shOut(cmd: string, args: string[]): string {
  return execFileSync(cmd, args, { encoding: "utf8" });
}

function findDevice(deviceId: string): DeviceSpec {
  const device = DEVICE_MATRIX.find((d) => d.id === deviceId);
  if (!device) throw new Error(`Unknown device: ${deviceId}`);
  return device;
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

function androidImagesDir(locale: "en" | "ar"): string {
  return path.join(
    PROJECT_ROOT,
    "fastlane",
    "metadata",
    "android",
    ANDROID_PLAY_LOCALE[locale],
    "images"
  );
}

function platformConfig(platform: TargetPlatform): PlatformConfig {
  if (platform === "android") {
    return {
      deviceId: "android-phone",
      bootFlow: "boot.android.yaml",
      shotFlow: "shot.android.yaml",
      resolveTarget: getBootedAndroidSerial,
      outPath: ({ locale, stem }) =>
        path.join(androidImagesDir(locale), "phoneScreenshots", `${stem}.png`),
      featurePath: (locale) => path.join(androidImagesDir(locale), "featureGraphic.png"),
    };
  }
  return {
    deviceId: "iphone-6.9",
    bootFlow: "boot.yaml",
    shotFlow: "shot.yaml",
    resolveTarget: getBootedDeviceId,
    // deliver wants screenshots directly under the locale dir and infers the
    // device from image resolution — no device subfolder.
    outPath: ({ locale, stem }) => path.join(OUT_DIR, "ios", IOS_LOCALE_DIR[locale], `${stem}.png`),
    featurePath: () => {
      throw new Error("Feature graphic is a Play Store asset; use --platform=android.");
    },
  };
}

function rawPath(opts: {
  screen: ScreenKey;
  locale: "en" | "ar";
  deviceId: string;
  platform: TargetPlatform;
  theme?: "light" | "dark";
}): string {
  const theme = opts.theme ?? "light";
  return path.join(RAW_DIR, opts.platform, opts.locale, theme, opts.deviceId, `${opts.screen}.png`);
}

function captureRaw(opts: {
  screen: ScreenKey;
  locale: "en" | "ar";
  seed: string;
  deviceId: string;
  bootedUdid: string;
  platform: TargetPlatform;
  theme?: "light" | "dark";
}): Buffer {
  const { screen, locale, seed, deviceId, bootedUdid, platform, theme } = opts;
  const cfg = platformConfig(platform);
  const out = rawPath({ screen, locale, deviceId, platform, theme });
  mkdirSync(path.dirname(out), { recursive: true });
  // Maestro appends `.png`; pass the stem, read back with the extension.
  const stem = out.replace(/\.png$/, "");

  const themeParam = theme ? `&theme=${theme}` : "";
  const url = `myapp://screenshot/${screen}?locale=${locale}&seed=${seed}${themeParam}`;
  const flowPath = path.join(SCRIPT_DIR, "flows", cfg.shotFlow);
  const readyId = `shot-ready-${screen}-${locale}`;

  shQuiet("maestro", [
    "--device",
    bootedUdid,
    "test",
    "-e",
    `SCREENSHOT_URL=${url}`,
    "-e",
    `OUT_PATH=${stem}`,
    "-e",
    `READY_ID=${readyId}`,
    flowPath,
  ]);

  if (!existsSync(out)) {
    throw new Error(`Maestro did not produce ${out} — check the flow output above`);
  }
  return readFileSync(out);
}

function bootApp(bootedUdid: string, platform: TargetPlatform): void {
  const flowPath = path.join(SCRIPT_DIR, "flows", platformConfig(platform).bootFlow);
  console.log(`[boot] cold-launching app once on ${bootedUdid}`);
  shQuiet("maestro", ["--device", bootedUdid, "test", flowPath]);
}

// Build one store cell. `honest` is pure HTML; `athkar` needs en+ar captures;
// `hero` needs the single-locale capture. Pass a capture function so the same
// builder serves live capture (`all`) and cached re-render (`recomposite`).
async function buildCell(opts: {
  cell: PlanCell;
  locale: "en" | "ar";
  device: DeviceSpec;
  getRaw: (screen: ScreenKey, locale: "en" | "ar") => Buffer;
}): Promise<Buffer> {
  const { cell, locale, device, getRaw } = opts;
  if (cell.variant === "honest") {
    return renderVariant({ screen: cell.screen, device, locale, variant: "honest" });
  }
  if (cell.variant === "athkar") {
    return renderVariant({
      rawPngs: { en: getRaw(cell.screen, "en"), ar: getRaw(cell.screen, "ar") },
      screen: cell.screen,
      device,
      locale,
      variant: "athkar",
    });
  }
  return renderVariant({
    rawPng: getRaw(cell.screen, locale),
    screen: cell.screen,
    device,
    locale,
    variant: "hero",
  });
}

function writeCell(opts: {
  cell: PlanCell;
  locale: "en" | "ar";
  device: DeviceSpec;
  platform: TargetPlatform;
  buf: Buffer;
}): string {
  const cfg = platformConfig(opts.platform);
  const outPath = cfg.outPath({
    locale: opts.locale,
    deviceId: opts.device.id,
    stem: fileStem(opts.cell),
  });
  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, opts.buf);
  return outPath;
}

function parseFlags(): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 3; i < process.argv.length; i++) {
    const m = process.argv[i].match(/^--(\w[\w-]*)(?:=(.+))?$/);
    if (m) out[m[1]] = m[2] ?? "true";
  }
  return out;
}

// (cell, locale) pairs for a platform: every store slot in both locales.
function planCells(platform: TargetPlatform): { cell: PlanCell; locale: "en" | "ar" }[] {
  return planFor(platform).flatMap((cell) =>
    (["en", "ar"] as const).map((locale) => ({ cell, locale }))
  );
}

async function runAll(opts: {
  platform: TargetPlatform;
  deviceOverride?: string;
  resume?: boolean;
}): Promise<void> {
  const { platform, resume } = opts;
  const cfg = platformConfig(platform);
  const device = findDevice(opts.deviceOverride ?? cfg.deviceId);
  const bootedUdid = cfg.resolveTarget();
  bootApp(bootedUdid, platform);

  // With --resume, reuse a cached raw when present instead of re-capturing —
  // turns an interrupted run's expensive device I/O into an instant re-render.
  const getRaw = (screen: ScreenKey, locale: "en" | "ar") => {
    const cached = rawPath({ screen, locale, deviceId: device.id, platform });
    if (resume && existsSync(cached)) return readFileSync(cached);
    return captureRaw({
      screen,
      locale,
      seed: DEFAULT_SEED[screen],
      deviceId: device.id,
      bootedUdid,
      platform,
    });
  };

  const cells = planCells(platform);
  const failures: string[] = [];
  for (let i = 0; i < cells.length; i++) {
    const { cell, locale } = cells[i];
    const label = `${fileStem(cell)}/${locale}`;
    const startedAt = Date.now();
    console.log(`[${i + 1}/${cells.length}] ${label} …`);
    try {
      const buf = await buildCell({ cell, locale, device, getRaw });
      const out = writeCell({ cell, locale, device, platform, buf });
      const secs = ((Date.now() - startedAt) / 1000).toFixed(1);
      console.log(`[${i + 1}/${cells.length}] ${label} ✓ (${secs}s) → ${out}`);
    } catch (e) {
      console.error(`[${i + 1}/${cells.length}] ${label} ✗ FAILED:`, e);
      failures.push(label);
    }
  }
  await closeBrowser();
  if (failures.length) {
    console.error(`\n[all] ${failures.length} cell(s) failed: ${failures.join(", ")}`);
    process.exit(1);
  }
  console.log(`\n[all] ${cells.length} cells composited.`);
}

async function runRecomposite(opts: {
  platform: TargetPlatform;
  deviceOverride?: string;
}): Promise<void> {
  const { platform } = opts;
  const cfg = platformConfig(platform);
  const device = findDevice(opts.deviceOverride ?? cfg.deviceId);

  const getRaw = (screen: ScreenKey, locale: "en" | "ar") => {
    const file = rawPath({ screen, locale, deviceId: device.id, platform });
    if (!existsSync(file)) throw new Error(`Missing cached raw: ${file} — run a capture first`);
    return readFileSync(file);
  };

  const failures: string[] = [];
  for (const { cell, locale } of planCells(platform)) {
    try {
      const buf = await buildCell({ cell, locale, device, getRaw });
      const out = writeCell({ cell, locale, device, platform, buf });
      console.log(`✓ recomposited ${platform}/${locale}/${fileStem(cell)} → ${out}`);
    } catch (e) {
      console.error(`[recomposite] FAILED ${fileStem(cell)}/${locale}:`, e);
      failures.push(`${fileStem(cell)}/${locale}`);
    }
  }
  await closeBrowser();
  if (failures.length) {
    console.error(`\n[recomposite] ${failures.length} failed: ${failures.join(", ")}`);
    process.exit(1);
  }
  console.log(`\n[recomposite] ${planCells(platform).length} cells re-rendered from cached raws.`);
}

async function runVerify(opts: {
  platform: TargetPlatform;
  screen: ScreenKey;
  locale: "en" | "ar";
  variant: Variant;
  seed?: string;
  theme?: "light" | "dark";
  deviceOverride?: string;
}): Promise<void> {
  const { platform, screen, locale, variant, theme } = opts;
  const cfg = platformConfig(platform);
  const device = findDevice(opts.deviceOverride ?? cfg.deviceId);
  const planned = planFor(platform).find((c) => c.screen === screen);
  const cell: PlanCell = { idx: planned?.idx ?? 0, screen, variant };

  let bootedUdid: string | null = null;
  const getRaw = (s: ScreenKey, loc: "en" | "ar") => {
    bootedUdid ??= cfg.resolveTarget();
    return captureRaw({
      screen: s,
      locale: loc,
      seed: opts.seed ?? DEFAULT_SEED[s],
      deviceId: device.id,
      bootedUdid,
      platform,
      theme,
    });
  };

  if (variant !== "honest") {
    bootedUdid = cfg.resolveTarget();
    bootApp(bootedUdid, platform);
  }
  const buf = await buildCell({ cell, locale, device, getRaw });
  const out = writeCell({ cell, locale, device, platform, buf });
  await closeBrowser();
  console.log(`\n✓ Verification cell produced:\n  ${out}\n`);
  console.log(`Open it (\`open ${out}\`) and approve visually before proceeding.\n`);
}

// Transparent, tightly-cropped framed device for website use.
async function runFrame(opts: {
  platform: TargetPlatform;
  screen: ScreenKey;
  locale: "en" | "ar";
  fromCache: boolean;
  seed?: string;
  theme?: "light" | "dark";
  deviceOverride?: string;
}): Promise<void> {
  const { platform, screen, locale, fromCache, theme } = opts;
  const cfg = platformConfig(platform);
  const device = findDevice(opts.deviceOverride ?? cfg.deviceId);

  let raw: Buffer;
  if (fromCache) {
    const file = rawPath({ screen, locale, deviceId: device.id, platform, theme });
    if (!existsSync(file)) throw new Error(`Missing cached raw: ${file} — capture first`);
    raw = readFileSync(file);
  } else {
    const bootedUdid = cfg.resolveTarget();
    bootApp(bootedUdid, platform);
    raw = captureRaw({
      screen,
      locale,
      seed: opts.seed ?? DEFAULT_SEED[screen],
      deviceId: device.id,
      bootedUdid,
      platform,
      theme,
    });
  }

  const buf = await renderVariant({ rawPng: raw, screen, device, locale, variant: "frame" });
  await closeBrowser();
  mkdirSync(WEBSITE_DIR, { recursive: true });
  const out = path.join(
    WEBSITE_DIR,
    `frame-${screen}-${platform}-${locale}-${theme ?? "light"}.png`
  );
  writeFileSync(out, buf);
  console.log(`✓ frame → ${out}`);
}

// Play feature graphic (1024x500) for en + ar. Uses a cached prayer-times raw
// for the inset device when present; otherwise renders the banner without it.
async function runFeatureGraphic(): Promise<void> {
  const cfg = platformConfig("android");

  for (const locale of ["en", "ar"] as const) {
    // Inset device is generic, so any cached prayer-times raw works — prefer
    // android, fall back to the iOS capture.
    const insetFile = [
      rawPath({ screen: "prayer-times", locale, deviceId: "android-phone", platform: "android" }),
      rawPath({ screen: "prayer-times", locale, deviceId: "iphone-6.9", platform: "ios" }),
    ].find((f) => existsSync(f));
    const rawPng = insetFile ? readFileSync(insetFile) : undefined;
    if (!rawPng)
      console.log(`[feature-graphic] no cached prayer-times raw for ${locale}; banner only`);
    const buf = await renderFeatureGraphic({ locale, rawPng });
    const out = cfg.featurePath(locale);
    mkdirSync(path.dirname(out), { recursive: true });
    writeFileSync(out, buf);
    console.log(`✓ feature-graphic ${locale} → ${out}`);
  }
  await closeBrowser();
}

const USAGE =
  "Usage:\n" +
  "  bun run.ts all [--platform=ios|android] [--resume] — full store set in one app session\n" +
  "  bun run.ts recomposite [--platform=ios|android]    — re-render store set from cached raws\n" +
  "  bun run.ts verify [--platform=] [--screen=] [--locale=en|ar] [--variant=hero|honest|athkar] [--theme=light|dark] [--seed=]\n" +
  "  bun run.ts frame --screen=<key> [--platform=] [--locale=en|ar] [--theme=light|dark] [--from-cache]  — website device frame\n" +
  "  bun run.ts feature-graphic                         — Play 1024x500 banner (en + ar)";

function asPlatform(value: string | undefined): TargetPlatform {
  if (value === "android") return "android";
  if (value !== undefined && value !== "ios") {
    console.error(`Unknown platform: ${value}. Valid: ios, android`);
    process.exit(2);
  }
  return "ios";
}

function asScreen(value: string | undefined, fallback: ScreenKey): ScreenKey {
  const screen = (value ?? fallback) as ScreenKey;
  if (!SCREEN_KEYS.includes(screen)) {
    console.error(`Unknown screen: ${screen}. Valid: ${SCREEN_KEYS.join(", ")}`);
    process.exit(2);
  }
  return screen;
}

if (import.meta.main) {
  const cmd = process.argv[2];
  const flags = parseFlags();
  const platform = asPlatform(flags.platform);
  const deviceOverride = flags.device;
  const locale = (flags.locale ?? "en") as "en" | "ar";
  const theme = flags.theme as "light" | "dark" | undefined;
  if (theme !== undefined && theme !== "light" && theme !== "dark") {
    console.error(`Unknown theme: ${theme}. Valid: light, dark`);
    process.exit(2);
  }

  const run = (p: Promise<void>) =>
    p.catch((e) => {
      console.error(e);
      process.exit(1);
    });

  if (cmd === "all") {
    run(runAll({ platform, deviceOverride, resume: flags.resume === "true" }));
  } else if (cmd === "recomposite") {
    run(runRecomposite({ platform, deviceOverride }));
  } else if (cmd === "verify") {
    const screen = asScreen(flags.screen, "prayer-times");
    const variant = (flags.variant ?? "hero") as Variant;
    if (!["hero", "honest", "athkar"].includes(variant)) {
      console.error(`Unknown variant: ${variant}. Valid: hero, honest, athkar`);
      process.exit(2);
    }
    run(runVerify({ platform, screen, locale, variant, seed: flags.seed, theme, deviceOverride }));
  } else if (cmd === "frame") {
    const screen = asScreen(flags.screen, "prayer-times");
    run(
      runFrame({
        platform,
        screen,
        locale,
        fromCache: flags["from-cache"] === "true",
        seed: flags.seed,
        theme,
        deviceOverride,
      })
    );
  } else if (cmd === "feature-graphic") {
    run(runFeatureGraphic());
  } else {
    console.log(USAGE);
    process.exit(2);
  }
}
