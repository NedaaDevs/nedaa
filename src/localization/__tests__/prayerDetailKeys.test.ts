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

// English marks a count sentence with _one/_other; the stem is the key the code asks for.
const PLURAL = /_(one|other)$/;
const sheetKeys = Object.keys(en).filter(
  (key) => key.startsWith("prayerDetail.") || key.startsWith("a11y.prayerDetail.")
);
const plain = sheetKeys.filter((key) => !PLURAL.test(key));
const counted = [
  ...new Set(sheetKeys.filter((key) => PLURAL.test(key)).map((key) => key.replace(PLURAL, ""))),
];

// A locale falls back to English for a missing key, so nothing on screen shows the gap.
describe.each(Object.values(AppLocale))("the prayer sheet in %s", (locale) => {
  const bundle = BUNDLES[locale];

  it.each(plain)("defines %s", (key) => {
    expect(bundle[key]).toEqual(expect.stringMatching(/\S/));
  });

  // Every form the language's plural rule can pick, not only English's two.
  it.each(counted)("inflects %s for every count", (stem) => {
    const forms = new Intl.PluralRules(locale).resolvedOptions().pluralCategories;
    for (const form of forms) {
      expect([form, bundle[`${stem}_${form}`]]).toEqual([form, expect.stringMatching(/\S/)]);
    }
  });
});
