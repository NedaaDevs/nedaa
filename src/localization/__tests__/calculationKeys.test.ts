import { ASR_OPTIONS, MIDNIGHT_OPTIONS } from "@/components/calculation/calculationOptions";
import { PRAYER_TIME_PROVIDERS } from "@/constants/providers";
import { AppLocale } from "@/enums/app";
import ar from "@/localization/locales/ar.json";
import en from "@/localization/locales/en.json";
import ms from "@/localization/locales/ms.json";
import ur from "@/localization/locales/ur.json";

const BUNDLES: Record<AppLocale, Record<string, unknown>> = {
  [AppLocale.EN]: en,
  [AppLocale.AR]: ar,
  [AppLocale.MS]: ms,
  [AppLocale.UR]: ur,
};

const SCREEN_KEYS = Object.keys(en).filter((key) => key.startsWith("settings.calculation."));

// Every name and line the Calculation screen and its sheet read.
const READ_KEYS = [
  ...SCREEN_KEYS,
  ...[...ASR_OPTIONS, ...MIDNIGHT_OPTIONS].flatMap(({ nameKey, descriptionKey }) => [
    nameKey,
    descriptionKey,
  ]),
  ...PRAYER_TIME_PROVIDERS.ALADHAN.methods.map(
    ({ nameKey }) => `providers.aladhan.methods.${nameKey}`
  ),
];

// Counted keys by base name; English spells them _one and _other.
const PLURAL_BASES = [
  ...new Set(
    SCREEN_KEYS.filter((key) => /_(one|other)$/.test(key)).map((key) =>
      key.replace(/_(one|other)$/, "")
    )
  ),
];

describe.each(Object.values(AppLocale))("%s", (locale) => {
  // i18next picks the form by the locale's own plural rules: six in Arabic.
  const categories = new Intl.PluralRules(locale).resolvedOptions().pluralCategories;

  it.each(PLURAL_BASES)("has every plural form of %s", (base) => {
    categories.forEach((category) => {
      expect(typeof BUNDLES[locale][`${base}_${category}`]).toBe("string");
    });
  });

  it.each(READ_KEYS)("has %s", (key) => {
    expect(typeof BUNDLES[locale][key]).toBe("string");
    expect(BUNDLES[locale][key]).not.toBe("");
  });

  it("puts the place in the intro", () => {
    expect(BUNDLES[locale]["settings.calculation.intro"]).toContain("{{city}}");
  });
});
