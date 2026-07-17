import { BUNDLED_ORNAMENT_META } from "@/constants/Quran";
import { OrnamentAsset, OrnamentCategory, OrnamentSlot, QuranTheme } from "@/enums/quran";
import { bundledOrnamentModule, ornamentThemeSlot } from "@/utils/quranOrnaments";

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

describe("bundledOrnamentModule", () => {
  it("resolves a require id for every bundled category/asset/slot", () => {
    expect(
      bundledOrnamentModule(OrnamentCategory.SURAH_FRAME, OrnamentAsset.FRAME, OrnamentSlot.SEPIA)
    ).toBeDefined();
    expect(
      bundledOrnamentModule(OrnamentCategory.AYAH_MARKER, OrnamentAsset.MARKER, OrnamentSlot.DARK)
    ).toBeDefined();
    expect(
      bundledOrnamentModule(
        OrnamentCategory.PAGE_HOLDER,
        OrnamentAsset.QUARTER_RIGHT,
        OrnamentSlot.SEPIA
      )
    ).toBeDefined();
  });
  it("returns undefined for an asset a category does not carry", () => {
    expect(
      bundledOrnamentModule(
        OrnamentCategory.AYAH_MARKER,
        OrnamentAsset.CARTOUCHE,
        OrnamentSlot.SEPIA
      )
    ).toBeUndefined();
  });
});

describe("BUNDLED_ORNAMENT_META", () => {
  it("carries an aspect per category", () => {
    expect(
      BUNDLED_ORNAMENT_META[OrnamentCategory.SURAH_FRAME].assets[OrnamentAsset.FRAME].aspect
    ).toBeCloseTo(5.968, 2);
    expect(
      BUNDLED_ORNAMENT_META[OrnamentCategory.AYAH_MARKER].assets[OrnamentAsset.MARKER].aspect
    ).toBeCloseTo(0.75, 2);
  });
});
