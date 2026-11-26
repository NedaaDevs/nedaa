import { FONT_MAPPINGS } from "@/constants/Fonts";
import { AppLocale } from "@/enums/app";

/** Locales written in Arabic script; a Latin-only face has no glyphs for them. */
const ARABIC_SCRIPT_LOCALES = [AppLocale.AR, AppLocale.UR];

describe("font mappings", () => {
  // A missing locale falls through to the Latin face, so its text renders from a
  // system fallback rather than the app's font.
  it("covers every locale", () => {
    expect(Object.keys(FONT_MAPPINGS).sort()).toEqual(Object.values(AppLocale).sort());
  });

  it.each(ARABIC_SCRIPT_LOCALES)("%s uses the Arabic face", (locale) => {
    expect(FONT_MAPPINGS[locale].regular).toBe("IBMPlexSansArabic-Regular");
  });

  it.each([AppLocale.EN, AppLocale.MS])("%s uses the Latin face", (locale) => {
    expect(FONT_MAPPINGS[locale].regular).toBe("IBMPlexSans-Regular");
  });

  it("names a face for every weight", () => {
    for (const faces of Object.values(FONT_MAPPINGS)) {
      expect(Object.keys(faces).sort()).toEqual(["bold", "medium", "regular", "semibold"]);
    }
  });
});
