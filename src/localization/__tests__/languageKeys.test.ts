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

const KEYS = ["settings.languages.yourPlace", "settings.languages.choose"] as const;

/** The app name as a hand-written spelling, in any of its scripts. */
const HAND_WRITTEN_NAME = /nedaa|ن[ِ]?داء/i;

// A missing key falls back to English, so the screen never shows the gap.
describe.each(Object.values(AppLocale))("Language screen copy in %s", (locale) => {
  const bundle = BUNDLES[locale];

  it.each(KEYS)("defines %s", (key) => {
    expect(bundle[key]).toEqual(expect.stringMatching(/\S/));
  });

  it("names the app only through brand.name", () => {
    expect(KEYS.filter((key) => HAND_WRITTEN_NAME.test(String(bundle[key])))).toEqual([]);
  });
});

it("uses the design's Arabic words", () => {
  expect(KEYS.map((key) => ar[key])).toEqual(["موقعك", "لغة $t(brand.name)"]);
});
