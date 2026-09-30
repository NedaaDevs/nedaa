import { AppLocale } from "@/enums/app";
import i18n from "@/localization/i18n";
import { hijriAdjustmentLabel } from "@/utils/hijriAdjustment";

const inArabic = (offset: number) => hijriAdjustmentLabel(offset, i18n.getFixedT(AppLocale.AR));
const inEnglish = (offset: number) => hijriAdjustmentLabel(offset, i18n.getFixedT(AppLocale.EN));

describe("hijriAdjustmentLabel", () => {
  it("says there is no adjustment at zero", () => {
    expect(inEnglish(0)).toBe("No adjustment");
  });

  it.each([
    [1, "Plus 1 day"],
    [2, "Plus 2 days"],
    [-1, "Minus 1 day"],
    [-5, "Minus 5 days"],
  ])("reads %i in English as %s", (offset, expected) => {
    expect(inEnglish(offset)).toBe(expected);
  });

  // Arabic inflects the whole phrase: one, two, and three to ten each differ.
  it.each([
    [1, "زائد يوم واحد"],
    [2, "زائد يومين"],
    [3, "زائد ٣ أيام"],
    [5, "زائد ٥ أيام"],
    [-1, "ناقص يوم واحد"],
    [-2, "ناقص يومين"],
    [-4, "ناقص ٤ أيام"],
  ])("reads %i in Arabic as %s", (offset, expected) => {
    expect(inArabic(offset)).toBe(expected);
  });
});
