import { chromium, type Browser, type Page } from "playwright";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { DeviceSpec } from "./device-matrix.ts";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));

function fontBase64(filename: string): string {
  return readFileSync(path.join(SCRIPT_DIR, "fonts", filename)).toString("base64");
}

const FONT_FACES = `
  @font-face { font-family: 'Asap'; font-weight: 400; src: url('data:font/ttf;base64,${fontBase64("Asap-400.ttf")}') format('truetype'); font-style: normal; }
  @font-face { font-family: 'Asap'; font-weight: 700; src: url('data:font/ttf;base64,${fontBase64("Asap-700.ttf")}') format('truetype'); font-style: normal; }
  @font-face { font-family: 'Asap'; font-weight: 700; src: url('data:font/ttf;base64,${fontBase64("Asap-700.ttf")}') format('truetype'); font-style: italic; }
  @font-face { font-family: 'IBM Plex Sans Arabic'; font-weight: 400; src: url('data:font/ttf;base64,${fontBase64("IBMPlexSansArabic-400.ttf")}') format('truetype'); }
  @font-face { font-family: 'IBM Plex Sans Arabic'; font-weight: 700; src: url('data:font/ttf;base64,${fontBase64("IBMPlexSansArabic-700.ttf")}') format('truetype'); }
  @font-face { font-family: 'JetBrains Mono'; font-weight: 400; src: url('data:font/ttf;base64,${fontBase64("JetBrainsMono-400.ttf")}') format('truetype'); }
  @font-face { font-family: 'JetBrains Mono'; font-weight: 500; src: url('data:font/ttf;base64,${fontBase64("JetBrainsMono-500.ttf")}') format('truetype'); }
`;

export type Variant = "hero" | "fajr" | "athkar" | "honest" | "plate";

export type RenderInput = {
  rawPng: Buffer;
  screen: string;
  locale: "en" | "ar";
  device: DeviceSpec;
  variant: Variant;
};

type HeroCopy = {
  headlineLine1: string;
  headlineLine2Italic: string;
};

const HERO_COPY: Record<"en" | "ar", Record<string, HeroCopy>> = {
  en: {
    "prayer-times": {
      headlineLine1: "The call to prayer,",
      headlineLine2Italic: "dignified by design.",
    },
  },
  ar: {
    "prayer-times": {
      headlineLine1: "نداء الصلاة،",
      headlineLine2Italic: "بتصميمٍ يليق به.",
    },
  },
};

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!
  );
}

function heroHtml(opts: {
  rawPngBase64: string;
  copy: HeroCopy;
  device: DeviceSpec;
  locale: "en" | "ar";
}): string {
  const { copy, device, locale, rawPngBase64 } = opts;
  const isAr = locale === "ar";
  const dir = isAr ? "rtl" : "ltr";
  const fontFamily = isAr ? "IBM Plex Sans Arabic" : "Asap";
  // Frame dimensions. Slightly smaller than the editorial mock (820) so the phone
  // sits inside the canvas with breathing room at the bottom.
  const FRAME_W = 760;
  const FRAME_ASPECT = 19.5 / 9;
  const FRAME_H = FRAME_W * FRAME_ASPECT;
  const FRAME_RADIUS = FRAME_W * 0.13;
  const FRAME_BORDER = FRAME_W * 0.012;
  const FRAME_PADDING = FRAME_W * 0.018;
  const ISLAND_W = FRAME_W * 0.3;
  const ISLAND_H = FRAME_W * 0.078;
  const INNER_RADIUS = FRAME_RADIUS - FRAME_W * 0.02;

  return `<!doctype html>
<html lang="${locale}" dir="${dir}">
<head>
<meta charset="utf-8"/>
<style>
  ${FONT_FACES}
  html, body { margin: 0; padding: 0; }
  body {
    width: ${device.width}px;
    height: ${device.height}px;
    background: #F5F1E6;
    color: #1C5D85;
    font-family: '${fontFamily}', system-ui, sans-serif;
    position: relative;
    overflow: hidden;
    box-sizing: border-box;
    -webkit-font-smoothing: antialiased;
  }
  .ruled {
    position: absolute; inset: 0; pointer-events: none; opacity: 0.5;
    background-image: repeating-linear-gradient(to bottom, transparent 0, transparent 119px, rgba(15,44,68,0.10) 119px, rgba(15,44,68,0.10) 120px);
    -webkit-mask-image: linear-gradient(to bottom, transparent 0, #000 18%, #000 82%, transparent 100%);
            mask-image: linear-gradient(to bottom, transparent 0, #000 18%, #000 82%, transparent 100%);
  }
  .headline-block {
    padding: 200px 100px 60px;
    position: relative;
    text-align: center;
  }
  .headline {
    font-family: '${fontFamily}', system-ui, sans-serif;
    font-weight: 700;
    font-size: ${isAr ? 148 : 168}px;
    letter-spacing: -0.03em;
    line-height: 0.96;
    color: #0F2C44;
    margin: 36px 0 0;
    text-wrap: balance;
  }
  .italic-accent {
    font-style: italic;
    font-weight: 700;
    color: #1C5D85;
  }
  /* Phone */
  .phone-wrap {
    position: absolute;
    left: 50%;
    bottom: 140px;
    transform: translateX(-50%);
    width: ${FRAME_W}px;
    height: ${FRAME_H}px;
    filter: drop-shadow(0 60px 80px rgba(15,44,68,0.22));
  }
  .phone {
    width: 100%;
    height: 100%;
    background: #0A0A0F;
    border: ${FRAME_BORDER}px solid #1A1A1F;
    border-radius: ${FRAME_RADIUS}px;
    padding: ${FRAME_PADDING}px;
    position: relative;
    box-shadow: inset 0 0 0 2px rgba(255,255,255,0.04);
    box-sizing: border-box;
  }
  .island {
    position: absolute;
    top: ${FRAME_W * 0.028}px;
    left: 50%;
    transform: translateX(-50%);
    width: ${ISLAND_W}px;
    height: ${ISLAND_H}px;
    background: #000;
    border-radius: 9999px;
    z-index: 20;
  }
  .btn { position: absolute; background: #1A1A1F; }
  .btn.l1 { left: -4px; top: 14%; width: 4px; height: 5%; border-radius: 2px 0 0 2px; }
  .btn.l2 { left: -4px; top: 22%; width: 4px; height: 8%; border-radius: 2px 0 0 2px; }
  .btn.l3 { left: -4px; top: 32%; width: 4px; height: 8%; border-radius: 2px 0 0 2px; }
  .btn.r1 { right: -4px; top: 24%; width: 4px; height: 12%; border-radius: 0 2px 2px 0; }
  .screen {
    width: 100%;
    height: 100%;
    border-radius: ${INNER_RADIUS}px;
    overflow: hidden;
    background: #F5F7FA;
  }
  .screen img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: top center;
    display: block;
  }
</style>
</head>
<body>
  <div aria-hidden="true" class="ruled"></div>

  <div class="headline-block">
    <h1 class="headline">
      ${escapeHtml(copy.headlineLine1)}<br/>
      <span class="italic-accent">${escapeHtml(copy.headlineLine2Italic)}</span>
    </h1>
  </div>

  <div class="phone-wrap">
    <div class="phone">
      <div aria-hidden="true" class="island"></div>
      <div class="btn l1"></div>
      <div class="btn l2"></div>
      <div class="btn l3"></div>
      <div class="btn r1"></div>
      <div class="screen">
        <img src="data:image/png;base64,${rawPngBase64}" alt=""/>
      </div>
    </div>
  </div>
</body>
</html>`;
}

let _browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (_browser) return _browser;
  _browser = await chromium.launch();
  return _browser;
}

export async function closeBrowser(): Promise<void> {
  if (_browser) {
    await _browser.close();
    _browser = null;
  }
}

export async function renderVariant(input: RenderInput): Promise<Buffer> {
  if (input.variant !== "hero") {
    throw new Error(`Variant ${input.variant} not yet implemented. Only "hero" is wired.`);
  }
  const copy = HERO_COPY[input.locale][input.screen];
  if (!copy) {
    throw new Error(`No hero copy for ${input.locale}/${input.screen}. Add it to HERO_COPY.`);
  }
  const rawPngBase64 = input.rawPng.toString("base64");
  const html = heroHtml({
    rawPngBase64,
    copy,
    device: input.device,
    locale: input.locale,
  });

  const browser = await getBrowser();
  const ctx = await browser.newContext({
    viewport: { width: input.device.width, height: input.device.height },
    deviceScaleFactor: 1,
  });
  const page: Page = await ctx.newPage();
  await page.setContent(html, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => document.fonts.ready);
  const buf = await page.screenshot({ type: "png", fullPage: false });
  await ctx.close();
  return buf;
}
