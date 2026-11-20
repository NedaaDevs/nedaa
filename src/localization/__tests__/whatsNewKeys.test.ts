import { WHATS_NEW_ENTRIES } from "@/constants/WhatsNew";
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

/** Each locale's sentence stop. */
const FULL_STOP: Record<AppLocale, string> = {
  [AppLocale.EN]: ".",
  [AppLocale.AR]: ".",
  [AppLocale.MS]: ".",
  [AppLocale.UR]: "۔",
};

const BRAND = "$t(brand.name)";

/** Release-note strings that name the app. */
const NAMING = ["whatsNew.textSize.description"];

/** Keys the cards read beyond each entry's own. */
const SHARED = ["a11y.whatsNew.enable", "whatsNew.enabled", "whatsNew.notNow"];

describe.each(Object.values(AppLocale))("%s release notes", (locale) => {
  const text = (key: string) => String(BUNDLES[locale][key] ?? "");

  it.each(WHATS_NEW_ENTRIES.map(({ descriptionKey }) => descriptionKey))(
    "ends %s with a full stop",
    (key) => {
      expect(text(key).endsWith(FULL_STOP[locale])).toBe(true);
    }
  );

  it.each(SHARED)("has %s", (key) => {
    expect(text(key)).not.toBe("");
  });

  it.each(NAMING)("names the app in %s through brand.name", (key) => {
    expect(text(key)).toContain(BRAND);
  });
});
