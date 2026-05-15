import sharp from "sharp";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { DeviceSpec } from "./device-matrix.ts";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));

const FRAME_SHADOW_BLUR_RATIO = 0.018;
const FRAME_SHADOW_OFFSET_Y_RATIO = 0.008;

const BACKDROP_TOP = "#f4f1ea";
const BACKDROP_MID = "#e6e0d2";
const BACKDROP_BOTTOM = "#cdc2ac";

function backdropSvg(w: number, h: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">
    <defs>
      <linearGradient id="g" gradientTransform="rotate(15)">
        <stop offset="0%" stop-color="${BACKDROP_TOP}"/>
        <stop offset="55%" stop-color="${BACKDROP_MID}"/>
        <stop offset="100%" stop-color="${BACKDROP_BOTTOM}"/>
      </linearGradient>
    </defs>
    <rect width="${w}" height="${h}" fill="url(#g)"/>
  </svg>`;
}

function loadPrerenderedHeadline(opts: {
  deviceId: DeviceSpec["id"];
  screen: string;
  locale: "en" | "ar";
}): Buffer {
  const file = path.join(
    SCRIPT_DIR,
    "headlines-prerendered",
    opts.deviceId,
    opts.locale,
    `${opts.screen}.png`
  );
  if (!existsSync(file)) {
    throw new Error(
      `Pre-rendered headline missing: ${file}. Run \`bun render-headlines-chromium.ts\` to generate.`
    );
  }
  return readFileSync(file);
}

function shadowSvg(opts: {
  canvasWidth: number;
  canvasHeight: number;
  innerLeft: number;
  innerTop: number;
  innerWidth: number;
  innerHeight: number;
}): string {
  const blur = Math.round(opts.canvasHeight * FRAME_SHADOW_BLUR_RATIO);
  const offsetY = Math.round(opts.canvasHeight * FRAME_SHADOW_OFFSET_Y_RATIO);
  const r = Math.round(opts.innerWidth * 0.105);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${opts.canvasWidth} ${opts.canvasHeight}">
    <defs>
      <filter id="s" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="${blur}"/>
      </filter>
    </defs>
    <rect
      x="${opts.innerLeft}"
      y="${opts.innerTop + offsetY}"
      width="${opts.innerWidth}"
      height="${opts.innerHeight}"
      rx="${r}"
      fill="#1a2540"
      opacity="0.18"
      filter="url(#s)"
    />
  </svg>`;
}

export async function composite(input: {
  rawPng: Buffer;
  screen: string;
  device: DeviceSpec;
  locale: "en" | "ar";
  skipFrame?: boolean;
}): Promise<Buffer> {
  const { device, rawPng, screen, locale, skipFrame = false } = input;

  const backdrop = await sharp(Buffer.from(backdropSvg(device.width, device.height)))
    .png()
    .toBuffer();

  const headlineLayer = loadPrerenderedHeadline({
    deviceId: device.id,
    screen,
    locale,
  });

  const headlineBottom = Math.round(device.height * 0.18);
  const bottomMargin = Math.round(device.height * 0.04);
  const sideMargin = Math.round(device.width * 0.05);
  const aspect = device.capturedRawHeight / device.capturedRawWidth;
  const maxWidth = device.width - sideMargin * 2;
  const maxHeight = device.height - headlineBottom - bottomMargin;
  // Fit inner content in available area while preserving aspect ratio.
  const widthFromHeight = Math.round(maxHeight / aspect);
  const innerWidth = Math.min(maxWidth, widthFromHeight);
  const innerHeight = Math.round(innerWidth * aspect);
  const innerLeft = Math.round((device.width - innerWidth) / 2);
  const innerTop = headlineBottom + Math.round((maxHeight - innerHeight) / 2);

  const shadowLayer = await sharp(
    Buffer.from(
      shadowSvg({
        canvasWidth: device.width,
        canvasHeight: device.height,
        innerLeft,
        innerTop,
        innerWidth,
        innerHeight,
      })
    )
  )
    .png()
    .toBuffer();

  const cornerRadius = Math.round(innerWidth * 0.105);
  const resizedRaw = await sharp(rawPng)
    .resize(innerWidth, innerHeight)
    .composite([
      {
        input: Buffer.from(
          `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${innerWidth} ${innerHeight}">
            <rect width="${innerWidth}" height="${innerHeight}" rx="${cornerRadius}" fill="white"/>
          </svg>`
        ),
        blend: "dest-in",
      },
    ])
    .png()
    .toBuffer();

  const frameStroke = Math.round(device.width * 0.028);
  const frameSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${device.width} ${device.height}">
    <rect
      x="${innerLeft - frameStroke / 2}"
      y="${innerTop - frameStroke / 2}"
      width="${innerWidth + frameStroke}"
      height="${innerHeight + frameStroke}"
      rx="${cornerRadius + frameStroke / 2}"
      fill="none"
      stroke="#1a2540"
      stroke-width="${frameStroke}"
    />
  </svg>`;
  const frameLayer = skipFrame ? null : await sharp(Buffer.from(frameSvg)).png().toBuffer();

  const layers: sharp.OverlayOptions[] = [
    { input: shadowLayer, top: 0, left: 0 },
    { input: headlineLayer, top: 0, left: 0 },
    { input: resizedRaw, top: innerTop, left: innerLeft },
  ];
  if (frameLayer) layers.push({ input: frameLayer, top: 0, left: 0 });

  return sharp(backdrop).composite(layers).flatten({ background: BACKDROP_TOP }).png().toBuffer();
}
