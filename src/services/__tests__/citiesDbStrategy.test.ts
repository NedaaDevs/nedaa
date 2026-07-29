import { activeTier, shouldOfferFullPack, citiesPackUrl } from "@/services/citiesDbStrategy";
import { CitiesTier } from "@/types/cities";
import { CITIES_PACK_VERSION, CITIES_PACK_BYTES, CITIES_FULL_CITY_COUNT } from "@/constants/Cities";

describe("activeTier", () => {
  test("uses the full pack once it is installed", () => {
    expect(activeTier(true)).toBe(CitiesTier.FULL);
  });

  test("falls back to the bundled seed when the full pack is absent", () => {
    expect(activeTier(false)).toBe(CitiesTier.SEED);
  });
});

describe("shouldOfferFullPack", () => {
  test("offers the pack while only the seed is installed, even when results exist", () => {
    expect(shouldOfferFullPack(false, 12)).toBe(true);
  });

  test("offers the pack when a search returns nothing", () => {
    expect(shouldOfferFullPack(false, 0)).toBe(true);
  });

  test("never offers the pack once it is installed", () => {
    expect(shouldOfferFullPack(true, 0)).toBe(false);
    expect(shouldOfferFullPack(true, 12)).toBe(false);
  });
});

describe("citiesPackUrl", () => {
  test("builds a versioned CDN path", () => {
    expect(citiesPackUrl("2026-07-29")).toBe(
      "https://cdn.nedaa.dev/cities/2026-07-29/cities.db.gz"
    );
  });

  test("uses the configured pack version by default", () => {
    expect(citiesPackUrl(CITIES_PACK_VERSION)).toContain(CITIES_PACK_VERSION);
  });
});

describe("pack constants", () => {
  test("the declared version looks like an ISO date, matching what the build script writes", () => {
    expect(CITIES_PACK_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test("the declared size is close to the built artifact, so the disclosure is honest", () => {
    // Built pack measured at 6,072,972 bytes; allow drift from a rebuild.
    expect(CITIES_PACK_BYTES).toBeGreaterThan(5_500_000);
    expect(CITIES_PACK_BYTES).toBeLessThan(7_000_000);
  });

  test("the advertised city count matches the full dataset", () => {
    expect(CITIES_FULL_CITY_COUNT).toBe(69537);
  });
});
