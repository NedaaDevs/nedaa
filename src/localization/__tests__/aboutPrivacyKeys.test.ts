import { AppLocale } from "@/enums/app";
import en from "@/localization/locales/en.json";
import ar from "@/localization/locales/ar.json";
import ms from "@/localization/locales/ms.json";
import ur from "@/localization/locales/ur.json";

const BUNDLES: Record<AppLocale, Record<string, unknown>> = {
  [AppLocale.EN]: en,
  [AppLocale.AR]: ar,
  [AppLocale.MS]: ms,
  [AppLocale.UR]: ur,
};

const PREFIXES = ["settings.about.", "a11y.about.", "settings.privacy."];
const keys = Object.keys(en).filter((key) => PREFIXES.some((prefix) => key.startsWith(prefix)));

// A locale falls back to English for a missing key, so nothing on screen shows the gap.
describe.each(Object.values(AppLocale))("About and Privacy in %s", (locale) => {
  const bundle = BUNDLES[locale];

  it("finds the keys", () => {
    expect(keys.length).toBeGreaterThan(20);
  });

  it.each([...keys, "a11y.opens"])("defines %s", (key) => {
    expect(bundle[key]).toEqual(expect.stringMatching(/\S/));
  });
});

/** The app name as a hand-written spelling, in any of its scripts. */
const HAND_WRITTEN_NAME = /nedaa|ن[ِ]?داء/i;

/** A claim about analytics tooling that a build with a platform location kit cannot keep. */
const TOOLING_CLAIM = /analytic|analitik|sdk|تحليل|تجزیاتی/i;

describe.each(Object.values(AppLocale))("About and Privacy copy in %s", (locale) => {
  const bundle = BUNDLES[locale];
  const copy = keys.map((key) => [key, String(bundle[key])] as const);

  // One spelling on screen: every string reaches the name through brand.name.
  it("names the app only through brand.name", () => {
    expect(copy.filter(([, text]) => HAND_WRITTEN_NAME.test(text))).toEqual([]);
  });

  it("makes no claim about analytics tooling", () => {
    expect(copy.filter(([, text]) => TOOLING_CLAIM.test(text))).toEqual([]);
  });
});
