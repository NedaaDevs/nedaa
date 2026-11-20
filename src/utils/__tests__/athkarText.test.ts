import { AppLocale } from "@/enums/app";
import { DHIKR_TEXT } from "@/constants/AthkarSession";
import { athkarLine, keyText, resolveDhikrText, type DhikrText } from "@/utils/athkarText";

const ARABIC = "سبحان الله";
const TRANSLATION = "Glory be to Allah";
const BOTH = `${TRANSLATION}\n${ARABIC}`;

const KEY = "athkar.items.one";
const LOCALE_TEXT: Record<string, string> = { [KEY]: BOTH };
const t = (key: string) => LOCALE_TEXT[key] ?? key;
const raw = (translation: string | null): DhikrText => ({
  kind: DHIKR_TEXT.RAW,
  arabic: ARABIC,
  translation,
});

describe("resolveDhikrText", () => {
  it("reads a locale key and splits its translation from its Arabic", () => {
    expect(resolveDhikrText(keyText(KEY), t, AppLocale.EN)).toEqual({
      arabic: ARABIC,
      translation: TRANSLATION,
    });
  });

  it("gives raw text as it is, with no lookup", () => {
    const lookup = jest.fn(t);
    expect(resolveDhikrText(raw(TRANSLATION), lookup, AppLocale.EN)).toEqual({
      arabic: ARABIC,
      translation: TRANSLATION,
    });
    expect(lookup).not.toHaveBeenCalled();
  });

  it("gives raw text no translation in Arabic, as a locale key has none there", () => {
    expect(resolveDhikrText(raw(TRANSLATION), t, AppLocale.AR).translation).toBeNull();
  });

  it("gives raw text with an empty translation none", () => {
    expect(resolveDhikrText(raw(""), t, AppLocale.EN).translation).toBeNull();
    expect(resolveDhikrText(raw(null), t, AppLocale.EN).translation).toBeNull();
  });
});

describe("athkarLine", () => {
  it("names a dhikr by its translation where translations show", () => {
    expect(athkarLine(raw(TRANSLATION), t, AppLocale.EN, true)).toBe(TRANSLATION);
  });

  it("names it by its Arabic where translations are hidden", () => {
    expect(athkarLine(raw(TRANSLATION), t, AppLocale.EN, false)).toBe(ARABIC);
  });

  it("names it by its Arabic where the text has no translation", () => {
    expect(athkarLine(raw(null), t, AppLocale.EN, true)).toBe(ARABIC);
    expect(athkarLine(raw(null), t, AppLocale.AR, true)).toBe(ARABIC);
  });

  it("keeps to the first line of a longer translation", () => {
    expect(
      athkarLine(
        { kind: DHIKR_TEXT.RAW, arabic: ARABIC, translation: `${TRANSLATION}\nsecond line` },
        t,
        AppLocale.EN,
        true
      )
    ).toBe(TRANSLATION);
  });
});
