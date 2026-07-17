import { OrnamentAsset, OrnamentSlot } from "@/enums/quran";
import { ornamentSlotFileName, parseOrnamentPackJson } from "@/utils/quranOrnaments";

describe("parseOrnamentPackJson", () => {
  it("parses a valid pack.json", () => {
    const meta = parseOrnamentPackJson(
      JSON.stringify({
        version: "a1",
        assets: { frame: { aspect: 5.9, panel: { l: 0.1, t: 0.2, r: 0.1, b: 0.2 } } },
      })
    );
    expect(meta?.version).toBe("a1");
    expect(meta?.assets.frame.aspect).toBe(5.9);
    expect(meta?.assets.frame.panel?.l).toBe(0.1);
  });
  it("returns null on malformed json", () => {
    expect(parseOrnamentPackJson("{not json")).toBeNull();
  });
  it("returns null when required shape is missing", () => {
    expect(parseOrnamentPackJson(JSON.stringify({ version: "a1" }))).toBeNull();
    expect(parseOrnamentPackJson(JSON.stringify({ assets: {} }))).toBeNull();
  });
});

describe("ornamentSlotFileName", () => {
  it("builds <asset>-<slot>.png", () => {
    expect(ornamentSlotFileName(OrnamentAsset.FRAME, OrnamentSlot.DARK)).toBe("frame-dark.png");
    expect(ornamentSlotFileName(OrnamentAsset.QUARTER_LEFT, OrnamentSlot.SEPIA)).toBe(
      "quarter-left-sepia.png"
    );
  });
});
