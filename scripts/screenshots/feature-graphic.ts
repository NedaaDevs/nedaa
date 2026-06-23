import type { Page } from "playwright";
import { FONT_FACES, getBrowser } from "./render-variant.ts";

// Google Play feature graphic: fixed 1024x500 banner shown atop the listing.
export const FEATURE_GRAPHIC = { width: 1024, height: 500 } as const;

type FeatureCopy = {
  headlineLead: string;
  headlineAccent: string;
  tagline: string;
};

const COPY: Record<"en" | "ar", FeatureCopy> = {
  en: {
    headlineLead: "Never miss",
    headlineAccent: "a prayer.",
    tagline: "Prayer times · Adhan · Athkar · Qibla — private, free, no ads.",
  },
  ar: {
    headlineLead: "لا تفوتك",
    headlineAccent: "صلاة.",
    tagline: "مواقيت · أذان · أذكار · قبلة — خصوصية، مجانًا، بلا إعلانات.",
  },
};

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!
  );
}

function featureGraphicHtml(opts: { locale: "en" | "ar"; rawPngBase64?: string }): string {
  const { locale, rawPngBase64 } = opts;
  const { width: W, height: H } = FEATURE_GRAPHIC;
  const isAr = locale === "ar";
  const dir = isAr ? "rtl" : "ltr";
  const fontFamily = isAr ? "IBM Plex Sans Arabic" : "Asap";
  const copy = COPY[locale];

  const FRAME_W = 240;
  const FRAME_H = Math.round(FRAME_W * (19.5 / 9));
  const FRAME_RADIUS = Math.round(FRAME_W * 0.13);
  const INNER_RADIUS = FRAME_RADIUS - Math.round(FRAME_W * 0.02);
  const ISLAND_W = Math.round(FRAME_W * 0.3);
  const ISLAND_H = Math.round(FRAME_W * 0.078);

  const screen = rawPngBase64 ? `<img src="data:image/png;base64,${rawPngBase64}" alt=""/>` : "";

  return `<!doctype html>
<html lang="${locale}" dir="${dir}"><head><meta charset="utf-8"/>
<style>
  ${FONT_FACES}
  html, body { margin: 0; padding: 0; }
  body {
    width: ${W}px; height: ${H}px;
    background: linear-gradient(160deg, #F7F3E9 0%, #F1EBDC 55%, #E8E1CF 100%);
    font-family: '${fontFamily}', system-ui, sans-serif;
    position: relative; overflow: hidden;
    display: flex; align-items: center;
  }
  .text { padding: 0 64px; max-width: 620px; z-index: 2; }
  .headline {
    font-weight: 700; font-size: 88px; line-height: 0.98;
    letter-spacing: -0.03em; color: #0F2C44; margin: 0;
  }
  .accent { color: #1C5D85; }
  .tagline { font-size: 28px; color: #4B5563; margin: 24px 0 0; line-height: 1.3; max-width: 19ch; }
  .stage {
    position: absolute; top: 50%;
    ${isAr ? "left" : "right"}: 70px;
    transform: translateY(-50%) rotate(${isAr ? 6 : -6}deg);
    width: ${FRAME_W}px; height: ${FRAME_H}px;
    filter: drop-shadow(0 24px 40px rgba(15,44,68,0.28));
  }
  .phone {
    width: 100%; height: 100%;
    background: #0A0A0F; border: 3px solid #1A1A1F;
    border-radius: ${FRAME_RADIUS}px; padding: 5px; box-sizing: border-box;
    position: relative;
  }
  .island {
    position: absolute; top: 7px; left: 50%; transform: translateX(-50%);
    width: ${ISLAND_W}px; height: ${ISLAND_H}px; background: #000;
    border-radius: 9999px; z-index: 20;
  }
  .screen { width: 100%; height: 100%; border-radius: ${INNER_RADIUS}px; overflow: hidden; background: #F5F7FA; }
  .screen img { width: 100%; height: 100%; object-fit: cover; object-position: top center; display: block; }
</style></head>
<body>
  <div class="text">
    <h1 class="headline">${escapeHtml(copy.headlineLead)} <span class="accent">${escapeHtml(copy.headlineAccent)}</span></h1>
    <p class="tagline">${escapeHtml(copy.tagline)}</p>
  </div>
  <div class="stage">
    <div class="phone">
      <div aria-hidden="true" class="island"></div>
      <div class="screen">${screen}</div>
    </div>
  </div>
</body></html>`;
}

export async function renderFeatureGraphic(opts: {
  locale: "en" | "ar";
  rawPng?: Buffer;
}): Promise<Buffer> {
  const html = featureGraphicHtml({
    locale: opts.locale,
    rawPngBase64: opts.rawPng?.toString("base64"),
  });
  const browser = await getBrowser();
  const ctx = await browser.newContext({
    viewport: { width: FEATURE_GRAPHIC.width, height: FEATURE_GRAPHIC.height },
    deviceScaleFactor: 1,
  });
  const page: Page = await ctx.newPage();
  await page.setContent(html, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => document.fonts.ready);
  const buf = await page.screenshot({ type: "png", fullPage: false });
  await ctx.close();
  return buf;
}
