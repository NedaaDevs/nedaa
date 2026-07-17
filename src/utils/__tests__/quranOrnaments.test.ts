import { OrnamentSlot, QuranTheme } from "@/enums/quran";
import { ornamentThemeSlot } from "@/utils/quranOrnaments";

describe("ornamentThemeSlot", () => {
  it("maps light papers to the sepia slot", () => {
    expect(ornamentThemeSlot(QuranTheme.LIGHT)).toBe(OrnamentSlot.SEPIA);
    expect(ornamentThemeSlot(QuranTheme.NEDAA_LIGHT)).toBe(OrnamentSlot.SEPIA);
    expect(ornamentThemeSlot(QuranTheme.SEPIA)).toBe(OrnamentSlot.SEPIA);
  });
  it("maps dark papers to the dark slot", () => {
    expect(ornamentThemeSlot(QuranTheme.DARK)).toBe(OrnamentSlot.DARK);
    expect(ornamentThemeSlot(QuranTheme.NEDAA_DARK)).toBe(OrnamentSlot.DARK);
  });
});
