import sharp from "sharp";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { DeviceSpec } from "./device-matrix.ts";
import { fontsFor } from "./fonts.ts";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));

function backdropSvg(w: number, h: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">
    <defs>
      <linearGradient id="g" gradientTransform="rotate(20)">
        <stop offset="0%" stop-color="#f4f1ea"/>
        <stop offset="50%" stop-color="#e6e0d2"/>
        <stop offset="100%" stop-color="#d9d0bd"/>
      </linearGradient>
    </defs>
    <rect width="${w}" height="${h}" fill="url(#g)"/>
  </svg>`;
}

async function renderHeadline(opts: {
  headline: string;
  subhead?: string;
  width: number;
  height: number;
  locale: "en" | "ar";
}): Promise<Buffer> {
  const fontFamily = opts.locale === "ar" ? "IBM Plex Sans Arabic" : "Asap";
  const direction = opts.locale === "ar" ? "rtl" : "ltr";
  const children: object[] = [
    {
      type: "div",
      props: {
        style: {
          fontSize: Math.round(opts.height * 0.045),
          fontWeight: 700,
          textAlign: "center",
          direction,
        },
        children: opts.headline,
      },
    },
  ];
  if (opts.subhead) {
    children.push({
      type: "div",
      props: {
        style: {
          marginTop: 24,
          fontSize: Math.round(opts.height * 0.022),
          fontWeight: 400,
          textAlign: "center",
          direction,
          opacity: 0.7,
        },
        children: opts.subhead,
      },
    });
  }
  const node = {
    type: "div",
    props: {
      style: {
        width: opts.width,
        height: opts.height,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        paddingTop: Math.round(opts.height * 0.06),
        fontFamily,
        color: "#1a2540",
      },
      children,
    },
  };
  const svg = await satori(node as never, {
    width: opts.width,
    height: opts.height,
    fonts: fontsFor(opts.locale),
  });
  return Buffer.from(new Resvg(svg).render().asPng());
}

export async function composite(input: {
  rawPng: Buffer;
  headline: string;
  subhead?: string;
  device: DeviceSpec;
  locale: "en" | "ar";
  skipFrame?: boolean;
}): Promise<Buffer> {
  const { device, rawPng, headline, subhead, locale, skipFrame = false } = input;

  const backdrop = await sharp(Buffer.from(backdropSvg(device.width, device.height)))
    .png()
    .toBuffer();

  const headlineLayer = await renderHeadline({
    headline,
    subhead,
    width: device.width,
    height: Math.round(device.height * 0.18),
    locale,
  });

  const frame = skipFrame
    ? null
    : await sharp(path.join(SCRIPT_DIR, device.framePath))
        .resize(device.width, device.height)
        .png()
        .toBuffer();

  // Position the raw inside the frame's cutout. Cutout starts ~13.5% from top, ~4.5% from left.
  const innerTop = Math.round(device.height * 0.135);
  const innerLeft = Math.round(device.width * 0.045);
  const innerWidth = device.width - innerLeft * 2;
  const innerHeight = Math.round(innerWidth * (device.capturedRawHeight / device.capturedRawWidth));

  const resizedRaw = await sharp(rawPng).resize(innerWidth, innerHeight).png().toBuffer();

  const layers: sharp.OverlayOptions[] = [
    { input: headlineLayer, top: 0, left: 0 },
    { input: resizedRaw, top: innerTop, left: innerLeft },
  ];
  if (frame) layers.push({ input: frame, top: 0, left: 0 });

  return sharp(backdrop).composite(layers).flatten({ background: "#f4f1ea" }).png().toBuffer();
}
