import { resolveLocalizedName, formatCityLabel, boundingBoxFor } from "@/utils/cities";
import { AppLocale } from "@/enums/app";
import type { CitySearchResult } from "@/types/cities";

const RIYADH: CitySearchResult = {
  gid: 108410,
  name: "Riyadh",
  names: { ar: "الرياض", ur: "ریاض", ms: null },
  latitude: 24.68773,
  longitude: 46.72185,
  countryCode: "SA",
  country: {
    name: "Saudi Arabia",
    names: { ar: "المملكة العربية السعودية", ur: "سعودی عرب", ms: "Arab Saudi" },
  },
  region: {
    code: "10",
    name: "Riyadh Region",
    names: { ar: "منطقة الرياض", ur: null, ms: null },
  },
  population: 4205961,
  timezone: "Asia/Riyadh",
};

describe("resolveLocalizedName", () => {
  test("returns the localized name when the locale has one", () => {
    expect(resolveLocalizedName("Riyadh", { ar: "الرياض", ur: null, ms: null }, AppLocale.AR)).toBe(
      "الرياض"
    );
  });

  test("falls back to the base name when the locale has none", () => {
    expect(resolveLocalizedName("Bradford", { ar: null, ur: null, ms: null }, AppLocale.AR)).toBe(
      "Bradford"
    );
  });

  test("uses the base name for English without consulting the map", () => {
    expect(resolveLocalizedName("Riyadh", { ar: "الرياض", ur: null, ms: null }, AppLocale.EN)).toBe(
      "Riyadh"
    );
  });

  test("falls back for a locale the cities data does not cover", () => {
    expect(resolveLocalizedName("Riyadh", { ar: "الرياض", ur: null, ms: null }, "fr")).toBe(
      "Riyadh"
    );
  });

  test("tolerates a missing names map", () => {
    expect(resolveLocalizedName("Riyadh", undefined, AppLocale.AR)).toBe("Riyadh");
  });

  test("handles a regional locale tag by its base language", () => {
    expect(resolveLocalizedName("Riyadh", { ar: "الرياض", ur: null, ms: null }, "ar-SA")).toBe(
      "الرياض"
    );
  });
});

describe("formatCityLabel", () => {
  test("builds city, region and country in English", () => {
    expect(formatCityLabel(RIYADH, AppLocale.EN)).toEqual({
      city: "Riyadh",
      secondary: "Riyadh Region, Saudi Arabia",
    });
  });

  test("localizes every part in Arabic", () => {
    expect(formatCityLabel(RIYADH, AppLocale.AR)).toEqual({
      city: "الرياض",
      secondary: "منطقة الرياض, المملكة العربية السعودية",
    });
  });

  test("falls back per part, mixing localized and base names", () => {
    // Urdu has a city and country name but no region name.
    expect(formatCityLabel(RIYADH, AppLocale.UR)).toEqual({
      city: "ریاض",
      secondary: "Riyadh Region, سعودی عرب",
    });
  });

  test("omits the region when the city has none", () => {
    expect(formatCityLabel({ ...RIYADH, region: null }, AppLocale.EN).secondary).toBe(
      "Saudi Arabia"
    );
  });
});

describe("boundingBoxFor", () => {
  test("spans the requested degrees of latitude in both directions", () => {
    const box = boundingBoxFor(0, 0, 1);
    expect(box.maxLat - box.minLat).toBeCloseTo(2, 5);
  });

  test("widens longitude with latitude so the box stays roughly square in kilometres", () => {
    const equator = boundingBoxFor(0, 0, 1);
    const north = boundingBoxFor(60, 0, 1);
    expect(north.maxLng - north.minLng).toBeGreaterThan(equator.maxLng - equator.minLng);
  });

  test("clamps latitude to the poles", () => {
    expect(boundingBoxFor(89.5, 0, 2).maxLat).toBe(90);
    expect(boundingBoxFor(-89.5, 0, 2).minLat).toBe(-90);
  });

  test("caps the longitude span rather than dividing by a near-zero cosine", () => {
    const box = boundingBoxFor(89.999, 0, 1);
    expect(box.maxLng - box.minLng).toBeLessThanOrEqual(360);
    expect(Number.isFinite(box.maxLng)).toBe(true);
  });
});
