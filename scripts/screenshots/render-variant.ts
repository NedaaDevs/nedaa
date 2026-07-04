import { chromium, type Browser, type Page } from "playwright";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { DeviceSpec } from "./device-matrix.ts";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));

function fontBase64(filename: string): string {
  return readFileSync(path.join(SCRIPT_DIR, "fonts", filename)).toString("base64");
}

export const FONT_FACES = `
  @font-face { font-family: 'Asap'; font-weight: 400; src: url('data:font/ttf;base64,${fontBase64("Asap-400.ttf")}') format('truetype'); font-style: normal; }
  @font-face { font-family: 'Asap'; font-weight: 700; src: url('data:font/ttf;base64,${fontBase64("Asap-700.ttf")}') format('truetype'); font-style: normal; }
  @font-face { font-family: 'Asap'; font-weight: 700; src: url('data:font/ttf;base64,${fontBase64("Asap-700.ttf")}') format('truetype'); font-style: italic; }
  @font-face { font-family: 'IBM Plex Sans Arabic'; font-weight: 400; src: url('data:font/ttf;base64,${fontBase64("IBMPlexSansArabic-400.ttf")}') format('truetype'); }
  @font-face { font-family: 'IBM Plex Sans Arabic'; font-weight: 700; src: url('data:font/ttf;base64,${fontBase64("IBMPlexSansArabic-700.ttf")}') format('truetype'); }
  @font-face { font-family: 'JetBrains Mono'; font-weight: 400; src: url('data:font/ttf;base64,${fontBase64("JetBrainsMono-400.ttf")}') format('truetype'); }
  @font-face { font-family: 'JetBrains Mono'; font-weight: 500; src: url('data:font/ttf;base64,${fontBase64("JetBrainsMono-500.ttf")}') format('truetype'); }
`;

export type Variant = "hero" | "fajr" | "athkar" | "honest" | "plate" | "frame";

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
  // When true, the italic line is rendered as a caption beneath the phone
  // instead of stacked under line 1 in the top band. Use only when line 2 is a
  // standalone qualifier (not a sentence continuation that would dangle a comma).
  line2Below?: boolean;
  // Muted qualifier under the phone (e.g. OS-version requirement).
  footnote?: string;
};

const HERO_COPY: Record<"en" | "ar", Record<string, HeroCopy>> = {
  en: {
    "prayer-times": {
      headlineLine1: "The call to prayer,",
      headlineLine2Italic: "dignified by design.",
    },
    athkar: {
      headlineLine1: "Morning and evening,",
      headlineLine2Italic: "remembered out loud.",
    },
    qibla: {
      headlineLine1: "Where to face,",
      headlineLine2Italic: "no doubt about it.",
    },
    qada: {
      headlineLine1: "Qada fasting,",
      headlineLine2Italic: "tracked to the day.",
    },
    privacy: {
      headlineLine1: "Your data,",
      headlineLine2Italic: "stays on your phone.",
    },
    quran: {
      headlineLine1: "The mushaf,",
      headlineLine2Italic: "page by page.",
    },
    "athkar-with-audio": {
      headlineLine1: "Morning & evening athkar, with sound.",
      headlineLine2Italic: "Hisn al-Muslim or your own.",
      line2Below: true,
    },
    "reliable-alarms": {
      headlineLine1: "A Fajr alarm that rings,",
      headlineLine2Italic: "not just notifies.",
    },
    tools: {
      headlineLine1: "More than prayer times.",
      headlineLine2Italic: "Your full toolkit.",
    },
    umrah: {
      headlineLine1: "Your Umrah,",
      headlineLine2Italic: "step by step.",
    },
  },
  ar: {
    "prayer-times": {
      headlineLine1: "نداء الصلاة،",
      headlineLine2Italic: "بتصميمٍ يليق به.",
    },
    athkar: {
      headlineLine1: "أذكار الصباح والمساء،",
      headlineLine2Italic: "تُتلى بصوتٍ مسموع.",
    },
    qibla: {
      headlineLine1: "إلى أين تتّجه،",
      headlineLine2Italic: "بيقينٍ تامّ.",
    },
    qada: {
      headlineLine1: "صيام القضاء،",
      headlineLine2Italic: "محسوبٌ يومًا بيوم.",
    },
    privacy: {
      headlineLine1: "بياناتك،",
      headlineLine2Italic: "تبقى على جهازك.",
    },
    quran: {
      headlineLine1: "المصحف،",
      headlineLine2Italic: "صفحةً صفحة.",
    },
    "athkar-with-audio": {
      headlineLine1: "أذكار الصباح والمساء، بالصوت.",
      headlineLine2Italic: "حصن المسلم أو أذكارك.",
      line2Below: true,
    },
    "reliable-alarms": {
      headlineLine1: "منبّه فجرٍ يرنّ،",
      headlineLine2Italic: "لا مجرّد تنبيه.",
    },
    tools: {
      headlineLine1: "أكثر من مواقيت الصلاة.",
      headlineLine2Italic: "عُدّتك الكاملة.",
    },
    umrah: {
      headlineLine1: "عمرتك،",
      headlineLine2Italic: "خطوةً بخطوة.",
    },
  },
};

// iOS reliable alarms need iOS 26.1+ (AlarmKit); soften + footnote the claim.
const HERO_COPY_IOS_OVERRIDE: Partial<Record<"en" | "ar", Record<string, HeroCopy>>> = {
  en: {
    "reliable-alarms": {
      headlineLine1: "An alarm that wakes you,",
      headlineLine2Italic: "even on silent.",
      footnote: "Requires iOS 26.1 or later.",
    },
  },
  ar: {
    "reliable-alarms": {
      headlineLine1: "منبّه يوقظك،",
      headlineLine2Italic: "ولو كان الصوت صامتًا.",
      footnote: "يتطلب iOS 26.1 أو أحدث.",
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
  const isAndroid = device.platform === "android";
  const isTablet = device.chrome === "ipad";
  const line2Below = copy.line2Below === true;
  const W = device.width;
  const H = device.height;
  // Match the mockup's silhouette to the real device instead of assuming a
  // phone shape — an iPad screenshot squeezed into a 19.5:9 phone frame via
  // object-fit: cover crops most of the screen away.
  const ASPECT = device.height / device.width;

  // Responsive: a headline band is always kept; the phone is then made as large
  // as possible, bounded by EITHER a width cap OR the height left under the
  // band — whichever binds — so it never clips on a short canvas (Android
  // 1080x1920) yet fills a tall one (iOS 1290x2796).
  const HEADLINE_BAND = Math.round(H * 0.22);
  const BOTTOM_MARGIN = Math.round(H * 0.05);
  const SIDE = Math.round(W * 0.08);
  // A below-phone caption needs its own reserved strip so the phone shrinks to
  // make room rather than overflowing the canvas.
  const CAPTION_BAND = line2Below ? Math.round(H * 0.09) : 0;
  const FOOTNOTE_BAND = copy.footnote ? Math.round(H * 0.05) : 0;
  const availH = H - HEADLINE_BAND - BOTTOM_MARGIN - CAPTION_BAND - FOOTNOTE_BAND;
  const FRAME_H = Math.round(Math.min(availH, 0.82 * W * ASPECT));
  const FRAME_W = Math.round(FRAME_H / ASPECT);
  // iPad corners are far less rounded relative to device size than an
  // iPhone's, and its bezel is thin with a tiny camera dot sitting in it
  // (not a punch-hole cut into the screen like Android's).
  const FRAME_RADIUS = Math.round(FRAME_W * (isTablet ? 0.045 : 0.13));
  const FRAME_BORDER = Math.max(2, Math.round(FRAME_W * 0.012));
  const FRAME_PADDING = Math.round(FRAME_W * (isTablet ? 0.01 : 0.018));
  const ISLAND_W = Math.round(FRAME_W * 0.3);
  const ISLAND_H = Math.round(FRAME_W * 0.078);
  const PUNCH_D = Math.round(FRAME_W * (isTablet ? 0.012 : 0.052));
  const INNER_RADIUS = FRAME_RADIUS - Math.round(FRAME_W * 0.02);
  const headlineSize = Math.round(W * (isAr ? 0.092 : 0.105));
  const captionSize = Math.round(W * (isAr ? 0.06 : 0.066));
  const footnoteSize = Math.round(W * 0.032);
  const ruleGap = Math.round(H * 0.0425);
  const shadowY = Math.round(FRAME_W * 0.08);
  const shadowBlur = Math.round(FRAME_W * 0.1);
  // Platform-correct device chrome: iPhone Dynamic Island + iOS button layout,
  // Android punch-hole + side-mounted volume/power, or a borderless iPad bezel
  // with a small centered camera and no side buttons. The captured screen
  // already carries the right OS status bar and nav, so only the bezel differs.
  const deviceChrome = isTablet
    ? `<div aria-hidden="true" class="punch"></div>`
    : isAndroid
      ? `<div aria-hidden="true" class="punch"></div>
        <div class="btn ar1"></div>
        <div class="btn ar2"></div>`
      : `<div aria-hidden="true" class="island"></div>
        <div class="btn l1"></div>
        <div class="btn l2"></div>
        <div class="btn l3"></div>
        <div class="btn r1"></div>`;
  const headlineInner = line2Below
    ? escapeHtml(copy.headlineLine1)
    : `${escapeHtml(copy.headlineLine1)}<br/>
      <span class="italic-accent">${escapeHtml(copy.headlineLine2Italic)}</span>`;
  const captionHtml = line2Below
    ? `<div class="caption">${escapeHtml(copy.headlineLine2Italic)}</div>`
    : "";
  const footnoteHtml = copy.footnote
    ? `<div class="footnote">${escapeHtml(copy.footnote)}</div>`
    : "";

  return `<!doctype html>
<html lang="${locale}" dir="${dir}">
<head>
<meta charset="utf-8"/>
<style>
  ${FONT_FACES}
  html, body { margin: 0; padding: 0; }
  body {
    width: ${W}px;
    height: ${H}px;
    background: linear-gradient(160deg, #F7F3E9 0%, #F1EBDC 55%, #E8E1CF 100%);
    color: #1C5D85;
    font-family: '${fontFamily}', system-ui, sans-serif;
    position: relative;
    overflow: hidden;
    box-sizing: border-box;
    -webkit-font-smoothing: antialiased;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .ruled {
    position: absolute; inset: 0; pointer-events: none; opacity: 0.5;
    background-image: repeating-linear-gradient(to bottom, transparent 0, transparent ${ruleGap}px, rgba(15,44,68,0.10) ${ruleGap}px, rgba(15,44,68,0.10) ${ruleGap + 1}px);
    -webkit-mask-image: linear-gradient(to bottom, transparent 0, #000 18%, #000 82%, transparent 100%);
            mask-image: linear-gradient(to bottom, transparent 0, #000 18%, #000 82%, transparent 100%);
  }
  .headline-block {
    height: ${HEADLINE_BAND}px;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    text-align: center;
    padding: 0 ${SIDE}px;
    box-sizing: border-box;
    position: relative;
  }
  .headline {
    font-family: '${fontFamily}', system-ui, sans-serif;
    font-weight: 700;
    font-size: ${headlineSize}px;
    letter-spacing: -0.03em;
    line-height: 1.0;
    color: #0F2C44;
    margin: 0;
    text-wrap: balance;
  }
  .italic-accent { font-style: italic; font-weight: 700; color: #1C5D85; }
  .stage {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    padding-bottom: ${BOTTOM_MARGIN}px;
    box-sizing: border-box;
    position: relative;
  }
  .stage-col {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
  }
  .caption {
    font-family: '${fontFamily}', system-ui, sans-serif;
    font-style: italic;
    font-weight: 700;
    font-size: ${captionSize}px;
    color: #1C5D85;
    text-align: center;
    margin-top: ${Math.round(H * 0.03)}px;
    padding: 0 ${SIDE}px;
    line-height: 1.1;
    box-sizing: border-box;
  }
  .footnote {
    font-family: '${fontFamily}', system-ui, sans-serif;
    font-size: ${footnoteSize}px;
    color: #6B7280;
    text-align: center;
    margin-top: ${Math.round(H * 0.022)}px;
    padding: 0 ${SIDE}px;
    box-sizing: border-box;
  }
  .phone-wrap {
    width: ${FRAME_W}px;
    height: ${FRAME_H}px;
    filter: drop-shadow(0 ${shadowY}px ${shadowBlur}px rgba(15,44,68,0.22));
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
    top: ${Math.round(FRAME_W * 0.028)}px;
    left: 50%;
    transform: translateX(-50%);
    width: ${ISLAND_W}px;
    height: ${ISLAND_H}px;
    background: #000;
    border-radius: 9999px;
    z-index: 20;
  }
  .punch {
    position: absolute;
    top: ${isTablet ? Math.round((FRAME_BORDER + FRAME_PADDING) / 2 - PUNCH_D / 2) : Math.round(FRAME_W * 0.034)}px;
    left: 50%;
    transform: translateX(-50%);
    width: ${PUNCH_D}px;
    height: ${PUNCH_D}px;
    background: #000;
    border-radius: 9999px;
    z-index: 20;
  }
  .btn { position: absolute; background: #1A1A1F; }
  .btn.l1 { left: -4px; top: 14%; width: 4px; height: 5%; border-radius: 2px 0 0 2px; }
  .btn.l2 { left: -4px; top: 22%; width: 4px; height: 8%; border-radius: 2px 0 0 2px; }
  .btn.l3 { left: -4px; top: 32%; width: 4px; height: 8%; border-radius: 2px 0 0 2px; }
  .btn.r1 { right: -4px; top: 24%; width: 4px; height: 12%; border-radius: 0 2px 2px 0; }
  .btn.ar1 { right: -4px; top: 18%; width: 4px; height: 8%; border-radius: 0 2px 2px 0; }
  .btn.ar2 { right: -4px; top: 29%; width: 4px; height: 13%; border-radius: 0 2px 2px 0; }
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
      ${headlineInner}
    </h1>
  </div>

  <div class="stage">
    <div class="stage-col">
      <div class="phone-wrap">
        <div class="phone">
          ${deviceChrome}
          <div class="screen">
            <img src="data:image/png;base64,${rawPngBase64}" alt=""/>
          </div>
        </div>
      </div>
      ${captionHtml}
      ${footnoteHtml}
    </div>
  </div>
</body>
</html>`;
}

let _browser: Browser | null = null;

export async function getBrowser(): Promise<Browser> {
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
  const W = device.width;
  const H = device.height;

  // Responsive, no phone: a headline band on top, then the five rows are
  // distributed to fill the remaining height so there is no dead space at the
  // bottom on either canvas (iOS 1290x2796 / Android 1080x1920).
  const HEADLINE_BAND = Math.round(H * 0.22);
  const SIDE = Math.round(W * 0.085);
  const headlineSize = Math.round(W * (isAr ? 0.092 : 0.1));
  const numSize = Math.round(W * 0.028);
  const keySize = Math.round(W * 0.06);
  const bodySize = Math.round(W * 0.026);
  const numCol = Math.round(W * 0.1);
  const colGap = Math.round(W * 0.04);
  const ruleGap = Math.round(H * 0.0425);

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
    width: ${W}px;
    height: ${H}px;
    background: linear-gradient(160deg, #F7F3E9 0%, #F1EBDC 55%, #E8E1CF 100%);
    color: #1C5D85;
    font-family: '${fontFamily}', system-ui, sans-serif;
    position: relative;
    overflow: hidden;
    box-sizing: border-box;
    -webkit-font-smoothing: antialiased;
    display: flex;
    flex-direction: column;
  }
  .ruled {
    position: absolute; inset: 0; pointer-events: none; opacity: 0.5;
    background-image: repeating-linear-gradient(to bottom, transparent 0, transparent ${ruleGap}px, rgba(15,44,68,0.10) ${ruleGap}px, rgba(15,44,68,0.10) ${ruleGap + 1}px);
    -webkit-mask-image: linear-gradient(to bottom, transparent 0, #000 18%, #000 82%, transparent 100%);
            mask-image: linear-gradient(to bottom, transparent 0, #000 18%, #000 82%, transparent 100%);
  }
  .headline-block {
    height: ${HEADLINE_BAND}px;
    display: flex; align-items: center; justify-content: center;
    text-align: center;
    padding: 0 ${SIDE}px;
    box-sizing: border-box;
    position: relative;
  }
  .headline {
    font-family: '${fontFamily}', system-ui, sans-serif;
    font-weight: 700;
    font-size: ${headlineSize}px;
    letter-spacing: -0.03em;
    line-height: 1.0;
    color: #0F2C44;
    margin: 0;
    text-wrap: balance;
  }
  .italic-accent { font-style: italic; font-weight: 700; color: #1C5D85; }
  .promises {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: space-evenly;
    padding: 0 ${SIDE}px ${Math.round(H * 0.04)}px;
    box-sizing: border-box;
    position: relative;
  }
  .promise {
    display: grid;
    grid-template-columns: ${numCol}px 1fr;
    gap: ${colGap}px;
    align-items: baseline;
    padding: ${Math.round(H * 0.018)}px 0;
    border-top: 1px solid rgba(15,44,68,0.22);
  }
  .promise:last-child { border-bottom: 1px solid rgba(15,44,68,0.22); }
  .num {
    font-family: 'JetBrains Mono', ui-monospace, monospace;
    font-size: ${numSize}px;
    color: #1C5D85;
    letter-spacing: 0.06em;
    font-weight: 500;
  }
  .key {
    font-family: '${fontFamily}', system-ui, sans-serif;
    font-size: ${keySize}px;
    font-weight: 700;
    color: #0F2C44;
    letter-spacing: -0.015em;
    line-height: 1.0;
  }
  .body {
    font-family: '${fontFamily}', system-ui, sans-serif;
    font-size: ${bodySize}px;
    color: #4B5563;
    margin-top: ${Math.round(H * 0.006)}px;
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
    background: linear-gradient(160deg, #F7F3E9 0%, #F1EBDC 55%, #E8E1CF 100%);
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

// Frame-only render for website use: just the framed device on a transparent
// canvas, no headline or marketing background. Reuses the store bezel.
const FRAME_ONLY_WIDTH = 720;
const FRAME_ONLY_PAD = Math.round(FRAME_ONLY_WIDTH * 0.03);

function frameCanvasSize(): { width: number; height: number } {
  const frameH = Math.round(FRAME_ONLY_WIDTH * (19.5 / 9));
  return {
    width: FRAME_ONLY_WIDTH + FRAME_ONLY_PAD * 2,
    height: frameH + FRAME_ONLY_PAD * 2,
  };
}

function frameHtml(opts: { rawPngBase64: string; platform: DeviceSpec["platform"] }): string {
  const { rawPngBase64, platform } = opts;
  const isAndroid = platform === "android";
  const ASPECT = 19.5 / 9;
  const FRAME_W = FRAME_ONLY_WIDTH;
  const FRAME_H = Math.round(FRAME_W * ASPECT);
  const FRAME_RADIUS = Math.round(FRAME_W * 0.13);
  const FRAME_BORDER = Math.max(2, Math.round(FRAME_W * 0.012));
  const FRAME_PADDING = Math.round(FRAME_W * 0.018);
  const INNER_RADIUS = FRAME_RADIUS - Math.round(FRAME_W * 0.02);
  const ISLAND_W = Math.round(FRAME_W * 0.3);
  const ISLAND_H = Math.round(FRAME_W * 0.078);
  const PUNCH_D = Math.round(FRAME_W * 0.052);
  const PAD = Math.round(FRAME_W * 0.03);
  const deviceChrome = isAndroid
    ? `<div aria-hidden="true" class="punch"></div>
        <div class="btn ar1"></div>
        <div class="btn ar2"></div>`
    : `<div aria-hidden="true" class="island"></div>
        <div class="btn l1"></div>
        <div class="btn l2"></div>
        <div class="btn l3"></div>
        <div class="btn r1"></div>`;

  return `<!doctype html>
<html><head><meta charset="utf-8"/>
<style>
  html, body { margin: 0; padding: 0; background: transparent; }
  body { width: ${FRAME_W + PAD * 2}px; height: ${FRAME_H + PAD * 2}px; position: relative; }
  .phone {
    position: absolute; top: ${PAD}px; left: ${PAD}px;
    width: ${FRAME_W}px; height: ${FRAME_H}px;
    background: #0A0A0F;
    border: ${FRAME_BORDER}px solid #1A1A1F;
    border-radius: ${FRAME_RADIUS}px;
    padding: ${FRAME_PADDING}px;
    box-sizing: border-box;
    box-shadow: inset 0 0 0 2px rgba(255,255,255,0.04);
  }
  .island { position: absolute; top: ${Math.round(FRAME_W * 0.028)}px; left: 50%; transform: translateX(-50%); width: ${ISLAND_W}px; height: ${ISLAND_H}px; background: #000; border-radius: 9999px; z-index: 20; }
  .punch { position: absolute; top: ${Math.round(FRAME_W * 0.034)}px; left: 50%; transform: translateX(-50%); width: ${PUNCH_D}px; height: ${PUNCH_D}px; background: #000; border-radius: 9999px; z-index: 20; }
  .btn { position: absolute; background: #1A1A1F; }
  .btn.l1 { left: -4px; top: 14%; width: 4px; height: 5%; border-radius: 2px 0 0 2px; }
  .btn.l2 { left: -4px; top: 22%; width: 4px; height: 8%; border-radius: 2px 0 0 2px; }
  .btn.l3 { left: -4px; top: 32%; width: 4px; height: 8%; border-radius: 2px 0 0 2px; }
  .btn.r1 { right: -4px; top: 24%; width: 4px; height: 12%; border-radius: 0 2px 2px 0; }
  .btn.ar1 { right: -4px; top: 18%; width: 4px; height: 8%; border-radius: 0 2px 2px 0; }
  .btn.ar2 { right: -4px; top: 29%; width: 4px; height: 13%; border-radius: 0 2px 2px 0; }
  .screen { width: 100%; height: 100%; border-radius: ${INNER_RADIUS}px; overflow: hidden; background: #F5F7FA; }
  .screen img { width: 100%; height: 100%; object-fit: cover; object-position: top center; display: block; }
</style></head>
<body>
  <div class="phone">
    ${deviceChrome}
    <div class="screen"><img src="data:image/png;base64,${rawPngBase64}" alt=""/></div>
  </div>
</body></html>`;
}

export async function renderVariant(input: RenderInput): Promise<Buffer> {
  let html: string;
  if (input.variant === "hero") {
    if (!input.rawPng) throw new Error('Variant "hero" requires rawPng.');
    const override =
      input.device.platform === "ios"
        ? HERO_COPY_IOS_OVERRIDE[input.locale]?.[input.screen]
        : undefined;
    const copy = override ?? HERO_COPY[input.locale][input.screen];
    if (!copy) {
      throw new Error(`No hero copy for ${input.locale}/${input.screen}. Add it to HERO_COPY.`);
    }
    html = heroHtml({
      rawPngBase64: input.rawPng.toString("base64"),
      copy,
      device: input.device,
      locale: input.locale,
    });
  } else if (input.variant === "frame") {
    if (!input.rawPng) throw new Error('Variant "frame" requires rawPng.');
    html = frameHtml({
      rawPngBase64: input.rawPng.toString("base64"),
      platform: input.device.platform,
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

  // Frame-only is a transparent, tightly-cropped device; store cells fill the
  // full marketing canvas.
  const isFrame = input.variant === "frame";
  const viewport = isFrame
    ? frameCanvasSize()
    : { width: input.device.width, height: input.device.height };

  const browser = await getBrowser();
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page: Page = await ctx.newPage();
  await page.setContent(html, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => document.fonts.ready);
  const buf = await page.screenshot({ type: "png", fullPage: false, omitBackground: isFrame });
  await ctx.close();
  return buf;
}
