import { chromium } from "playwright";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadHeadlines, HEADLINE_KEYS } from "./headlines.schema.ts";
import { DEVICE_MATRIX } from "./device-matrix.ts";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(SCRIPT_DIR, "headlines-prerendered");

const HEADLINE_AREA_RATIO = 0.18;
const HEADLINE_PADDING_TOP_RATIO = 0.045;
const HEADLINE_FONT_RATIO = 0.038;
const SUBHEAD_FONT_RATIO = 0.018;
const SUBHEAD_MARGIN_TOP_RATIO = 0.012;

function fontBase64(filename: string): string {
  const buf = readFileSync(path.join(SCRIPT_DIR, "fonts", filename));
  return buf.toString("base64");
}

const FONT_FACES = {
  en: `
    @font-face { font-family: 'Asap'; font-weight: 400; src: url('data:font/ttf;base64,${fontBase64("Asap-400.ttf")}') format('truetype'); }
    @font-face { font-family: 'Asap'; font-weight: 700; src: url('data:font/ttf;base64,${fontBase64("Asap-700.ttf")}') format('truetype'); }
  `,
  ar: `
    @font-face { font-family: 'IBM Plex Sans Arabic'; font-weight: 400; src: url('data:font/ttf;base64,${fontBase64("IBMPlexSansArabic-400.ttf")}') format('truetype'); }
    @font-face { font-family: 'IBM Plex Sans Arabic'; font-weight: 700; src: url('data:font/ttf;base64,${fontBase64("IBMPlexSansArabic-700.ttf")}') format('truetype'); }
  `,
};

function buildHtml(opts: {
  width: number;
  height: number;
  headline: string;
  subhead?: string;
  locale: "en" | "ar";
}): string {
  const fontFamily = opts.locale === "ar" ? "IBM Plex Sans Arabic" : "Asap";
  const direction = opts.locale === "ar" ? "rtl" : "ltr";
  const headlineFont = Math.round(opts.height * HEADLINE_FONT_RATIO);
  const subheadFont = Math.round(opts.height * SUBHEAD_FONT_RATIO);
  const subheadMarginTop = Math.round(opts.height * SUBHEAD_MARGIN_TOP_RATIO);
  const paddingTop = Math.round(opts.height * HEADLINE_PADDING_TOP_RATIO);
  const sidePadding = Math.round(opts.width * 0.08);
  const blockHeight = Math.round(opts.height * HEADLINE_AREA_RATIO);
  const letterSpacing = opts.locale === "ar" ? "normal" : "-1px";

  return `<!doctype html>
<html dir="${direction}" lang="${opts.locale}">
<head>
<meta charset="utf-8"/>
<style>
  ${FONT_FACES[opts.locale]}
  html, body { margin: 0; padding: 0; background: transparent; }
  body { width: ${opts.width}px; height: ${blockHeight}px; }
  .wrap {
    width: ${opts.width}px;
    height: ${blockHeight}px;
    box-sizing: border-box;
    padding: ${paddingTop}px ${sidePadding}px 0 ${sidePadding}px;
    text-align: center;
    font-family: '${fontFamily}', sans-serif;
    color: #1a2540;
    direction: ${direction};
  }
  .h {
    font-weight: 700;
    font-size: ${headlineFont}px;
    line-height: 1.15;
    letter-spacing: ${letterSpacing};
  }
  .s {
    margin-top: ${subheadMarginTop}px;
    font-weight: 400;
    font-size: ${subheadFont}px;
    line-height: 1.35;
    opacity: 0.78;
  }
</style>
</head>
<body>
  <div class="wrap">
    <div class="h">${opts.headline}</div>
    ${opts.subhead ? `<div class="s">${opts.subhead}</div>` : ""}
  </div>
</body>
</html>`;
}

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ deviceScaleFactor: 1 });
  const page = await ctx.newPage();

  for (const device of DEVICE_MATRIX) {
    const blockHeight = Math.round(device.height * HEADLINE_AREA_RATIO);
    await page.setViewportSize({ width: device.width, height: blockHeight });
    for (const locale of ["en", "ar"] as const) {
      const headlines = loadHeadlines(locale);
      for (const key of HEADLINE_KEYS) {
        const entry = headlines[key];
        const html = buildHtml({
          width: device.width,
          height: device.height,
          headline: entry.headline,
          subhead: entry.subhead,
          locale,
        });
        await page.setContent(html);
        await page.evaluate(() => document.fonts.ready);
        const dir = path.join(OUT_DIR, device.id, locale);
        mkdirSync(dir, { recursive: true });
        const outPath = path.join(dir, `${key}.png`);
        await page.screenshot({ path: outPath, omitBackground: true, fullPage: false });
        console.log(`wrote ${path.relative(SCRIPT_DIR, outPath)}`);
      }
    }
  }
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
