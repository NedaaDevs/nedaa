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
  rawPng?: Buffer;
  rawPngs?: { en: Buffer; ar: Buffer };
  screen: string;
  locale: "en" | "ar";
  device: DeviceSpec;
  variant: Variant;
};

type BilingualCopy = {
  headlineLine1: string;
  headlineLine2Italic: string;
  lede: string;
};

const BILINGUAL_COPY: Record<"en" | "ar", BilingualCopy> = {
  en: {
    headlineLine1: "Athkar,",
    headlineLine2Italic: "in your tongue.",
    lede: "Morning and evening remembrances, with audio. English and Arabic, side by side.",
  },
  ar: {
    headlineLine1: "أذكار،",
    headlineLine2Italic: "بلغتك.",
    lede: "أذكار الصباح والمساء، مع الصوت. بالعربية والإنجليزية، جنبًا إلى جنب.",
  },
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

type PromiseRow = { key: string; body: string };

const PROMISES_COPY: Record<
  "en" | "ar",
  { headlineLine1: string; headlineLine1Italic: string; headlineLine2: string; rows: PromiseRow[] }
> = {
  en: {
    headlineLine1: "What we",
    headlineLine1Italic: "don't",
    headlineLine2: "take from you.",
    rows: [
      { key: "Free", body: "Forever. Not free-as-in-trial." },
      { key: "No ads", body: "Worship is not a billboard." },
      { key: "No accounts", body: "No sign-up. No email. No password." },
      { key: "No tracking", body: "No third-party SDKs. We don’t know who you are." },
      { key: "Open source", body: "github.com/NedaaDevs/nedaa. Read every line." },
    ],
  },
  ar: {
    headlineLine1: "ما",
    headlineLine1Italic: "لا",
    headlineLine2: "نأخذه منك.",
    rows: [
      { key: "مجاني", body: "إلى الأبد. ليس مجرّد فترة تجريبية." },
      { key: "بلا إعلانات", body: "العبادة ليست لوحة إعلانات." },
      { key: "بلا حسابات", body: "بلا تسجيل، ولا بريد، ولا كلمة مرور." },
      { key: "بلا تتبّع", body: "لا أنظمة تتبّع خارجية. لا نعرف من أنت." },
      { key: "مفتوح المصدر", body: "github.com/NedaaDevs/nedaa. اقرأ كلّ سطر." },
    ],
  },
};

function promisesHtml(opts: { device: DeviceSpec; locale: "en" | "ar" }): string {
  const { device, locale } = opts;
  const copy = PROMISES_COPY[locale];
  const isAr = locale === "ar";
  const dir = isAr ? "rtl" : "ltr";
  const fontFamily = isAr ? "IBM Plex Sans Arabic" : "Asap";

  const rows = copy.rows
    .map(
      (r, i) => `
    <div class="promise">
      <span class="num">0${i + 1}</span>
      <div class="text">
        <div class="key">${escapeHtml(r.key)}</div>
        <div class="body">${escapeHtml(r.body)}</div>
      </div>
    </div>`
    )
    .join("");

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
    text-align: center;
    position: relative;
  }
  .headline {
    font-family: '${fontFamily}', system-ui, sans-serif;
    font-weight: 700;
    font-size: ${isAr ? 148 : 160}px;
    letter-spacing: -0.03em;
    line-height: 1.0;
    color: #0F2C44;
    margin: 0;
    text-wrap: balance;
  }
  .italic-accent {
    font-style: italic;
    font-weight: 700;
    color: #1C5D85;
  }
  .promises {
    padding: 80px 110px 0;
    position: relative;
  }
  .promise {
    display: grid;
    grid-template-columns: 130px 1fr;
    gap: 48px;
    align-items: baseline;
    padding: 42px 0;
    border-top: 1px solid rgba(15,44,68,0.22);
  }
  .promise:last-child { border-bottom: 1px solid rgba(15,44,68,0.22); }
  .num {
    font-family: 'JetBrains Mono', ui-monospace, monospace;
    font-size: 36px;
    color: #1C5D85;
    letter-spacing: 0.06em;
    font-weight: 500;
  }
  .key {
    font-family: '${fontFamily}', system-ui, sans-serif;
    font-size: 80px;
    font-weight: 700;
    color: #0F2C44;
    letter-spacing: -0.015em;
    line-height: 1.0;
  }
  .body {
    font-family: '${fontFamily}', system-ui, sans-serif;
    font-size: 34px;
    color: #4B5563;
    margin-top: 16px;
    line-height: 1.3;
  }
</style>
</head>
<body>
  <div aria-hidden="true" class="ruled"></div>

  <div class="headline-block">
    <h1 class="headline">
      ${escapeHtml(copy.headlineLine1)} <span class="italic-accent">${escapeHtml(copy.headlineLine1Italic)}</span><br/>
      ${escapeHtml(copy.headlineLine2)}
    </h1>
  </div>

  <div class="promises">${rows}
  </div>
</body>
</html>`;
}

function bilingualHtml(opts: {
  enPngBase64: string;
  arPngBase64: string;
  copy: BilingualCopy;
  device: DeviceSpec;
  locale: "en" | "ar";
}): string {
  const { copy, device, locale, enPngBase64, arPngBase64 } = opts;
  const isAr = locale === "ar";
  const dir = isAr ? "rtl" : "ltr";
  const fontFamily = isAr ? "IBM Plex Sans Arabic" : "Asap";
  const FRAME_W = 520;
  const FRAME_ASPECT = 19.5 / 9;
  const FRAME_H = FRAME_W * FRAME_ASPECT;
  const FRAME_RADIUS = FRAME_W * 0.13;
  const FRAME_BORDER = FRAME_W * 0.012;
  const FRAME_PADDING = FRAME_W * 0.018;
  const ISLAND_W = FRAME_W * 0.3;
  const ISLAND_H = FRAME_W * 0.078;
  const INNER_RADIUS = FRAME_RADIUS - FRAME_W * 0.02;
  const GAP = 60;
  // In RTL locale we visually mirror so the locale-matching phone leads.
  const leftPng = isAr ? arPngBase64 : enPngBase64;
  const rightPng = isAr ? enPngBase64 : arPngBase64;

  const phoneMarkup = (pngBase64: string, extraClass = "") => `
    <div class="phone-wrap ${extraClass}">
      <div class="phone">
        <div aria-hidden="true" class="island"></div>
        <div class="btn l1"></div>
        <div class="btn l2"></div>
        <div class="btn l3"></div>
        <div class="btn r1"></div>
        <div class="screen">
          <img src="data:image/png;base64,${pngBase64}" alt=""/>
        </div>
      </div>
    </div>`;

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
    padding: 180px 110px 40px;
    text-align: center;
    position: relative;
  }
  .headline {
    font-family: '${fontFamily}', system-ui, sans-serif;
    font-weight: 700;
    font-size: ${isAr ? 140 : 156}px;
    letter-spacing: -0.03em;
    line-height: 0.96;
    color: #0F2C44;
    margin: 0;
    text-wrap: balance;
  }
  .italic-accent {
    font-style: italic;
    font-weight: 700;
    color: #1C5D85;
  }
  .lede {
    font-family: '${fontFamily}', system-ui, sans-serif;
    font-size: 38px;
    line-height: 1.4;
    color: #4B5563;
    margin: 36px auto 0;
    max-width: 28ch;
    text-wrap: pretty;
  }
  .stage {
    position: absolute;
    left: 0; right: 0;
    bottom: 160px;
    display: flex;
    flex-direction: row;
    justify-content: center;
    align-items: flex-end;
    gap: ${GAP}px;
  }
  .phone-wrap {
    width: ${FRAME_W}px;
    height: ${FRAME_H}px;
    filter: drop-shadow(0 60px 80px rgba(15,44,68,0.22));
  }
  .phone-wrap.lift { transform: translateY(-40px); }
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
    <p class="lede">${escapeHtml(copy.lede)}</p>
  </div>

  <div class="stage">
    ${phoneMarkup(leftPng)}
    ${phoneMarkup(rightPng, "lift")}
  </div>
</body>
</html>`;
}

export async function renderVariant(input: RenderInput): Promise<Buffer> {
  let html: string;
  if (input.variant === "hero") {
    if (!input.rawPng) throw new Error('Variant "hero" requires rawPng.');
    const copy = HERO_COPY[input.locale][input.screen];
    if (!copy) {
      throw new Error(`No hero copy for ${input.locale}/${input.screen}. Add it to HERO_COPY.`);
    }
    html = heroHtml({
      rawPngBase64: input.rawPng.toString("base64"),
      copy,
      device: input.device,
      locale: input.locale,
    });
  } else if (input.variant === "honest") {
    html = promisesHtml({ device: input.device, locale: input.locale });
  } else if (input.variant === "athkar") {
    if (!input.rawPngs?.en || !input.rawPngs?.ar) {
      throw new Error('Variant "athkar" requires rawPngs.en and rawPngs.ar.');
    }
    html = bilingualHtml({
      enPngBase64: input.rawPngs.en.toString("base64"),
      arPngBase64: input.rawPngs.ar.toString("base64"),
      copy: BILINGUAL_COPY[input.locale],
      device: input.device,
      locale: input.locale,
    });
  } else {
    throw new Error(`Variant ${input.variant} not yet implemented.`);
  }

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
