import { NEDAA_STYLE_ID } from "@/constants/Quran";
import { OrnamentCategory } from "@/enums/quran";
import type { QuranManifest } from "@/types/quran";
import { resolveOrnamentStyle } from "@/utils/quranOrnamentResolve";

const manifest = {
  ornaments: {
    surahFrame: {
      default: NEDAA_STYLE_ID,
      defaultByEdition: { v1: "v1", v2: "v2" },
      options: [
        { id: NEDAA_STYLE_ID, version: "n1", url: "o/nedaa.zip", bytes: 1, sha256: "x" },
        { id: "v1", version: "a1", url: "o/v1.zip", bytes: 1, sha256: "x", editions: ["v1"] },
        { id: "v2", version: "b1", url: "o/v2.zip", bytes: 1, sha256: "x", editions: ["v2"] },
      ],
    },
  },
} as unknown as QuranManifest;

describe("resolveOrnamentStyle", () => {
  it("prefers the user choice when present", () => {
    expect(resolveOrnamentStyle(OrnamentCategory.SURAH_FRAME, "v1", manifest, "v2")).toBe("v2");
  });
  it("falls back to defaultByEdition", () => {
    expect(resolveOrnamentStyle(OrnamentCategory.SURAH_FRAME, "v1", manifest)).toBe("v1");
  });
  it("falls back to group default when no edition default", () => {
    expect(resolveOrnamentStyle(OrnamentCategory.SURAH_FRAME, "v4", manifest)).toBe(NEDAA_STYLE_ID);
  });
  it("falls back to nedaa when the category is absent", () => {
    expect(resolveOrnamentStyle(OrnamentCategory.PAGE_HOLDER, "v1", manifest)).toBe(NEDAA_STYLE_ID);
    expect(resolveOrnamentStyle(OrnamentCategory.SURAH_FRAME, "v1", null)).toBe(NEDAA_STYLE_ID);
  });
});
