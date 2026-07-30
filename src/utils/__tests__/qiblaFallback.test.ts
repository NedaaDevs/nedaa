import {
  manualLocationToFix,
  calculateQiblaDirection,
  MANUAL_LOCATION_ACCURACY_METERS,
} from "@/utils/compass";
import type { ManualLocation } from "@/types/location";

const RIYADH: ManualLocation = {
  cityId: 108410,
  name: "Riyadh",
  names: { ar: "الرياض", ur: null, ms: null },
  region: null,
  countryCode: "SA",
  country: { name: "Saudi Arabia", names: { ar: "السعودية", ur: null, ms: null } },
  latitude: 24.68773,
  longitude: 46.72185,
  timezone: "Asia/Riyadh",
};

const NOW = 1_700_000_000_000;

describe("manualLocationToFix", () => {
  test("carries the coordinates through unchanged", () => {
    const fix = manualLocationToFix(RIYADH, NOW);
    expect(fix.latitude).toBe(24.68773);
    expect(fix.longitude).toBe(46.72185);
  });

  test("stamps the supplied time so staleness rules never expire a standing choice", () => {
    expect(manualLocationToFix(RIYADH, NOW).timestamp).toBe(NOW);
  });

  test("reports a city-scale accuracy rather than posing as a measured fix", () => {
    const fix = manualLocationToFix(RIYADH, NOW);
    expect(fix.accuracyMeters).toBe(MANUAL_LOCATION_ACCURACY_METERS);
    expect(fix.accuracyMeters).toBeGreaterThan(1000);
  });

  test("reports no altitude, which a chosen city cannot supply", () => {
    expect(manualLocationToFix(RIYADH, NOW).altitude).toBeNull();
  });
});

describe("qibla from a manual location", () => {
  test("produces a usable bearing", () => {
    const fix = manualLocationToFix(RIYADH, NOW);
    const bearing = calculateQiblaDirection(fix.latitude, fix.longitude);

    expect(Number.isFinite(bearing)).toBe(true);
    expect(bearing).toBeGreaterThanOrEqual(0);
    expect(bearing).toBeLessThan(360);
  });

  /**
   * The bearing error from a city-centre coordinate is roughly the offset divided by
   * the distance to Makkah, so a far-away city tolerates a large positional error.
   */
  test("barely moves when the coordinate is off by ~10km at continental distance", () => {
    const london = calculateQiblaDirection(51.5074, -0.1278);
    const tenKmNorth = calculateQiblaDirection(51.5974, -0.1278);

    expect(Math.abs(london - tenKmNorth)).toBeLessThan(0.5);
  });
});
