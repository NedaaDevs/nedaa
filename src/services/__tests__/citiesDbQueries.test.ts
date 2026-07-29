import { buildFtsQuery, pickNearest, toSearchResult, type CityRow } from "@/services/cities-db";
import type { CitySearchResult } from "@/types/cities";

const row = (overrides: Partial<CityRow> = {}): CityRow => ({
  gid: 2654993,
  name: "Bradford",
  lat: 53.79391,
  lng: -1.75206,
  cc: "GB",
  pop: 366187,
  timezone: "Europe/London",
  country_name: "United Kingdom",
  country_ar: "المملكة المتحدة",
  country_ur: null,
  country_ms: null,
  region_code: "ENG",
  region_name: "England",
  region_ar: "إنجلترا",
  region_ur: null,
  region_ms: null,
  name_ar: "برادفورد",
  name_ur: "بریڈفورڈ",
  name_ms: null,
  ...overrides,
});

describe("buildFtsQuery", () => {
  test("wraps a token as a quoted prefix so partial names match", () => {
    expect(buildFtsQuery("Birmingh")).toBe('"Birmingh"*');
  });

  test("joins multiple words so every token must match", () => {
    expect(buildFtsQuery("New York")).toBe('"New"* "York"*');
  });

  test("collapses repeated whitespace between tokens", () => {
    expect(buildFtsQuery("  New    York  ")).toBe('"New"* "York"*');
  });

  test("strips Arabic diacritics so a vocalized query matches stored names", () => {
    expect(buildFtsQuery("الرِياض")).toBe('"الرياض"*');
  });

  test("escapes embedded double quotes rather than breaking the MATCH expression", () => {
    expect(buildFtsQuery('a"b')).toBe('"a""b"*');
  });

  test("returns null for a blank query so callers skip the search", () => {
    expect(buildFtsQuery("   ")).toBeNull();
    expect(buildFtsQuery("")).toBeNull();
  });

  test("returns null when a query is nothing but diacritics", () => {
    expect(buildFtsQuery("ًٌ")).toBeNull();
  });
});

const cityAt = (gid: number, latitude: number, longitude: number): CitySearchResult => ({
  gid,
  name: `City${gid}`,
  names: { ar: null, ur: null, ms: null },
  latitude,
  longitude,
  countryCode: "GB",
  country: { name: "United Kingdom", names: { ar: null, ur: null, ms: null } },
  region: null,
  population: 1000,
  timezone: "Europe/London",
});

describe("pickNearest", () => {
  test("returns the closest city by great-circle distance", () => {
    const result = pickNearest(53.8, -1.7, [
      cityAt(1, 53.9, -1.7),
      cityAt(2, 53.81, -1.7),
      cityAt(3, 54.5, -1.7),
    ]);
    expect(result?.city.gid).toBe(2);
  });

  test("reports the distance in kilometres", () => {
    const result = pickNearest(53.8, -1.7, [cityAt(1, 53.8, -1.7)]);
    expect(result?.distanceKm).toBeCloseTo(0, 3);
  });

  test("returns null for an empty candidate list", () => {
    expect(pickNearest(0, 0, [])).toBeNull();
  });

  test("does not mistake longitude distance for latitude distance at high latitude", () => {
    // At 60°N one degree of longitude is about half a degree of latitude in km,
    // so the city one degree east is closer than the one one degree north.
    const result = pickNearest(60, 0, [cityAt(1, 61, 0), cityAt(2, 60, 1)]);
    expect(result?.city.gid).toBe(2);
  });
});

describe("toSearchResult", () => {
  test("maps a fully populated row", () => {
    const result = toSearchResult(row());
    expect(result.name).toBe("Bradford");
    expect(result.timezone).toBe("Europe/London");
    expect(result.names).toEqual({ ar: "برادفورد", ur: "بریڈفورڈ", ms: null });
    expect(result.region).toEqual({
      code: "ENG",
      name: "England",
      names: { ar: "إنجلترا", ur: null, ms: null },
    });
  });

  test("reports no region when the region code does not resolve", () => {
    expect(toSearchResult(row({ region_code: null, region_name: null })).region).toBeNull();
  });

  test("reports no region when the city carries no region code at all", () => {
    expect(toSearchResult(row({ region_code: null })).region).toBeNull();
  });

  test("falls back to the country code so an unmatched country never renders as blank", () => {
    const result = toSearchResult(row({ country_name: null, country_ar: null }));
    expect(result.country.name).toBe("GB");
  });
});
