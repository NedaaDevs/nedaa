import { OrnamentCategory } from "@/enums/quran";
import { useQuranStore } from "@/stores/quran";

jest.mock("expo-sqlite/kv-store", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

describe("quran store ornament slice", () => {
  beforeEach(() => {
    useQuranStore.setState({ ornamentStyle: {}, ornamentMeta: {} });
  });
  it("sets and clears a per-category user style", () => {
    useQuranStore.getState().setOrnamentStyle(OrnamentCategory.SURAH_FRAME, "v1");
    expect(useQuranStore.getState().ornamentStyle[OrnamentCategory.SURAH_FRAME]).toBe("v1");
    useQuranStore.getState().clearOrnamentStyle(OrnamentCategory.SURAH_FRAME);
    expect(useQuranStore.getState().ornamentStyle[OrnamentCategory.SURAH_FRAME]).toBeUndefined();
  });
  it("stores installed pack metadata", () => {
    useQuranStore.getState().setOrnamentMeta(OrnamentCategory.AYAH_MARKER, {
      version: "a1",
      assets: { marker: { aspect: 0.73 } },
    });
    expect(
      useQuranStore.getState().ornamentMeta[OrnamentCategory.AYAH_MARKER]?.assets.marker.aspect
    ).toBe(0.73);
  });
});
