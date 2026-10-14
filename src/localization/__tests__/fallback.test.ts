import i18n from "@/localization/i18n";
import { AppLocale } from "@/enums/app";
import { CROWDIN_LOCALES } from "@/test-helpers/locales";

// A key only en.json has, as a new key is until Crowdin translates it.
const UNTRANSLATED_KEY = "fallbackProbe.untranslated";
const ENGLISH_VALUE = "Shown in English";

beforeAll(() => {
  i18n.addResource(AppLocale.EN, "translation", UNTRANSLATED_KEY, ENGLISH_VALUE);
});

afterAll(() => i18n.changeLanguage(AppLocale.EN));

describe.each(CROWDIN_LOCALES)("a key %s lacks", (locale) => {
  it("renders the English value", async () => {
    await i18n.changeLanguage(locale);
    expect(i18n.exists(UNTRANSLATED_KEY, { lng: locale, fallbackLng: [] })).toBe(false);
    expect(i18n.t(UNTRANSLATED_KEY)).toBe(ENGLISH_VALUE);
  });
});
