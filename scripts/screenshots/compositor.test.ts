import { describe, expect, test } from "bun:test";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import { composite } from "./compositor.ts";
import { DEVICE_MATRIX } from "./device-matrix.ts";

const FIXTURE_DIR = path.resolve(import.meta.dir, "__fixtures__");

describe("compositor", () => {
  test("output dimensions match device spec", async () => {
    const device = DEVICE_MATRIX.find((d) => d.id === "iphone-6.9")!;
    const raw = readFileSync(path.join(FIXTURE_DIR, "raw-prayer-times-en-iphone69.png"));
    const out = await composite({
      rawPng: raw,
      headline: "Never miss a prayer",
      subhead: "Accurate times, beautifully shown",
      device,
      locale: "en",
    });
    const meta = await sharp(out).metadata();
    expect(meta.width).toBe(device.width);
    expect(meta.height).toBe(device.height);
  });

  test("output matches golden within 0.1% tolerance", async () => {
    const device = DEVICE_MATRIX.find((d) => d.id === "iphone-6.9")!;
    const raw = readFileSync(path.join(FIXTURE_DIR, "raw-prayer-times-en-iphone69.png"));
    const out = await composite({
      rawPng: raw,
      headline: "Never miss a prayer",
      subhead: "Accurate times, beautifully shown",
      device,
      locale: "en",
    });
    const goldenPath = path.join(FIXTURE_DIR, "golden-prayer-times-en-iphone69.png");
    if (!existsSync(goldenPath)) {
      writeFileSync(goldenPath, out);
      console.warn(`[golden] seeded ${goldenPath} — re-run test to validate`);
      return;
    }
    const a = PNG.sync.read(out);
    const b = PNG.sync.read(readFileSync(goldenPath));
    const diff = pixelmatch(a.data, b.data, null, a.width, a.height, { threshold: 0.1 });
    const ratio = diff / (a.width * a.height);
    expect(ratio).toBeLessThan(0.001);
  });
});
