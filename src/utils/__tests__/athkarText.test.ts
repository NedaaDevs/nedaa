import { AppLocale } from "@/enums/app";
import { athkarLine } from "@/utils/athkarText";

const ARABIC = "سبحان الله";
const TRANSLATION = "Glory be to Allah";
const BOTH = `${TRANSLATION}\n${ARABIC}`;

describe("athkarLine", () => {
  it("names a dhikr by its translation where translations show", () => {
    expect(athkarLine(BOTH, AppLocale.EN, true)).toBe(TRANSLATION);
  });

  it("names it by its Arabic where translations are hidden", () => {
    expect(athkarLine(BOTH, AppLocale.EN, false)).toBe(ARABIC);
  });

  it("names it by its Arabic where the text has no translation", () => {
    expect(athkarLine(ARABIC, AppLocale.EN, true)).toBe(ARABIC);
    expect(athkarLine(ARABIC, AppLocale.AR, true)).toBe(ARABIC);
  });

  it("keeps to the first line of a longer translation", () => {
    expect(athkarLine(`${TRANSLATION}\nsecond line\n${ARABIC}`, AppLocale.EN, true)).toBe(
      TRANSLATION
    );
  });
});
