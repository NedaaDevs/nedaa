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

const PREFIXES = [
  "settings.sections.",
  "settings.rows.",
  "settings.summary.",
  "a11y.settings.rate",
  "a11y.settings.share",
];

const ARABIC_FORMS = ["zero", "one", "two", "few", "many", "other"];
/** An offset of zero reads "No adjustment", so its phrases skip that form. */
const NONZERO_FORMS = ARABIC_FORMS.filter((form) => form !== "zero");

/** The count phrases the root reads, each with the Arabic forms it can take. */
const COUNTED: Record<string, readonly string[]> = {
  "settings.summary.alerts": ARABIC_FORMS,
  "settings.hijri.date.adjustments.plusDays": NONZERO_FORMS,
  "settings.hijri.date.adjustments.minusDays": NONZERO_FORMS,
};

/** Strings on the root that name the app. */
const NAMING = ["settings.rateApp", "settings.shareApp", "settings.shareMessage"];

/** Plural forms are checked per count phrase below; locales differ. */
const PLURAL_FORM = /_(zero|one|two|few|many|other)$/;

const keys = Object.keys(en).filter(
  (key) => PREFIXES.some((prefix) => key.startsWith(prefix)) && !PLURAL_FORM.test(key)
);

// A missing key falls back to English, so the screen hides the gap.
describe.each(Object.values(AppLocale))("Settings root in %s", (locale) => {
  const bundle = BUNDLES[locale];

  it("finds the keys", () => {
    expect(keys.length).toBeGreaterThan(10);
  });

  it.each([...keys, ...NAMING])("defines %s", (key) => {
    expect(bundle[key]).toEqual(expect.stringMatching(/\S/));
  });

  it.each(Object.keys(COUNTED))("defines %s for a count", (base) => {
    expect(bundle[`${base}_other`]).toEqual(expect.stringMatching(/\S/));
  });

  it("names the app only through brand.name", () => {
    // A link's host is an address, not the name on screen.
    const named = [...keys, ...NAMING].map((key) =>
      String(bundle[key]).replace(/https?:\/\/\S+/g, "")
    );

    expect(named.filter((text) => /nedaa|ن[ِ]?داء/i.test(text))).toEqual([]);
  });
});

// Arabic inflects a count six ways; a missing form reads as "other".
describe.each(Object.entries(COUNTED))("%s in Arabic", (base, forms) => {
  it.each(forms)("states the %s form", (form) => {
    expect(ar[`${base}_${form}` as keyof typeof ar]).toEqual(expect.stringMatching(/\S/));
  });
});
