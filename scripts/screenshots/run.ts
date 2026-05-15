import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEVICE_MATRIX } from "./device-matrix.ts";
import { composite } from "./compositor.ts";
import { loadHeadlines } from "./headlines.schema.ts";

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

async function verifyCell() {
  const screen = "prayer-times" as const;
  const locale = "en" as const;
  const seed = "madinah-dhuhr-2h14m";
  const deviceId = "iphone-6.9";

  const device = DEVICE_MATRIX.find((d) => d.id === deviceId);
  if (!device) throw new Error(`Unknown device: ${deviceId}`);

  const bootedUdid = getBootedDeviceId();

  const platform = "ios";
  const rawDir = path.join(RAW_DIR, platform, locale, device.id);
  mkdirSync(rawDir, { recursive: true });
  const rawPath = path.join(rawDir, `01-${screen}.png`);

  const url = `nedaa://screenshot/${screen}?locale=${locale}&seed=${seed}`;
  const flowPath = path.join(SCRIPT_DIR, "flows", "single-screen.yaml");

  console.log(`[verify] firing Maestro flow → ${url}`);
  process.env.SCREENSHOT_URL = url;
  process.env.OUT_PATH = rawPath;
  sh("maestro", ["--device", bootedUdid, "test", flowPath]);

  if (!existsSync(rawPath)) {
    throw new Error(`Maestro did not produce ${rawPath} — check the flow output above`);
  }
  console.log(`[verify] raw captured: ${rawPath}`);

  const headlines = loadHeadlines(locale);
  const entry = headlines[screen];
  const out = await composite({
    rawPng: readFileSync(rawPath),
    headline: entry.headline,
    subhead: entry.subhead,
    device,
    locale,
  });

  const outDir = path.join(OUT_DIR, platform, "en-US", device.id);
  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `01-${screen}.png`);
  writeFileSync(outPath, out);

  console.log(`\n✓ Verification cell produced:\n  ${outPath}\n`);
  console.log(`Open it (\`open ${outPath}\`) and approve visually before proceeding.\n`);
}

if (import.meta.main) {
  const cmd = process.argv[2];
  if (cmd === "verify") {
    verifyCell().catch((e) => {
      console.error(e);
      process.exit(1);
    });
  } else {
    console.log("Usage: bun run.ts verify");
    process.exit(2);
  }
}
