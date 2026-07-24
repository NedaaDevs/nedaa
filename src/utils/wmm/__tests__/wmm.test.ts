import { WMM_VALID_FROM, WMM_VALID_TO } from "@/utils/wmm/wmm2025Coefficients";
import { computeGeomagneticField, getMagneticDeclination, toDecimalYear } from "@/utils/wmm";

import { WMM2025_TEST_VALUES } from "./fixtures/wmm2025TestValues";

// The official test table prints to 0.01°/0.001 nT. A correct double-precision port
// reproduces it to well within these; the tolerances only guard last-digit rounding,
// which is amplified in declination near the poles where the horizontal field is small.
const FIELD_TOLERANCE_NT = 1;
const DECLINATION_TOLERANCE_DEG = 0.1;

describe("computeGeomagneticField", () => {
  it("reproduces the official field vector for a mid-latitude reference point", () => {
    // Row from WMM2025_TestValues.txt: 2025.0, 65 km, 43°N, 93°E → D = 0.50°.
    const field = computeGeomagneticField(43, 93, 65, 2025.0);

    expect(field).not.toBeNull();
    expect(field!.x).toBeCloseTo(24299.852822, 0);
    expect(field!.y).toBeCloseTo(210.517066, 0);
    expect(field!.z).toBeCloseTo(50037.923998, 0);
    expect(field!.declinationDeg).toBeCloseTo(0.5, 1);
  });

  it.each(WMM2025_TEST_VALUES)(
    "matches NOAA test value at year=$year alt=$altKm lat=$lat lon=$lon",
    ({ year, altKm, lat, lon, decl, x, y, z }) => {
      const field = computeGeomagneticField(lat, lon, altKm, year);
      expect(field).not.toBeNull();
      expect(field!.x).toBeCloseTo(x, -Math.log10(FIELD_TOLERANCE_NT * 2));
      expect(field!.y).toBeCloseTo(y, -Math.log10(FIELD_TOLERANCE_NT * 2));
      expect(field!.z).toBeCloseTo(z, -Math.log10(FIELD_TOLERANCE_NT * 2));
      expect(Math.abs(field!.declinationDeg - decl)).toBeLessThanOrEqual(DECLINATION_TOLERANCE_DEG);
    }
  );

  it("returns null before the model validity window", () => {
    expect(computeGeomagneticField(43, 93, 0, WMM_VALID_FROM - 0.1)).toBeNull();
  });

  it("returns null after the model validity window", () => {
    expect(computeGeomagneticField(43, 93, 0, WMM_VALID_TO + 0.1)).toBeNull();
  });
});

describe("toDecimalYear", () => {
  it("maps the start of a year to the whole number", () => {
    expect(toDecimalYear(new Date(Date.UTC(2025, 0, 1, 0, 0, 0)))).toBeCloseTo(2025.0, 4);
  });

  it("maps the start of the next year to the next whole number", () => {
    expect(toDecimalYear(new Date(Date.UTC(2026, 0, 1, 0, 0, 0)))).toBeCloseTo(2026.0, 4);
  });

  it("maps mid-year to roughly the half", () => {
    // 2025 is not a leap year; noon on 2 July is day 183 of 365.
    expect(toDecimalYear(new Date(Date.UTC(2025, 6, 2, 12, 0, 0)))).toBeCloseTo(2025.5, 2);
  });
});

describe("getMagneticDeclination", () => {
  it("returns the same declination as the core field for a given date", () => {
    const date = new Date(Date.UTC(2025, 0, 1, 0, 0, 0));
    const field = computeGeomagneticField(43, 93, 0, toDecimalYear(date));
    expect(getMagneticDeclination(43, 93, 0, date)).toBeCloseTo(field!.declinationDeg, 6);
  });

  it("treats a null altitude as sea level", () => {
    const date = new Date(Date.UTC(2025, 0, 1, 0, 0, 0));
    expect(getMagneticDeclination(43, 93, null, date)).toBeCloseTo(
      getMagneticDeclination(43, 93, 0, date)!,
      6
    );
  });

  it("returns null once the model has expired", () => {
    const expired = new Date(Date.UTC(2031, 0, 1, 0, 0, 0));
    expect(getMagneticDeclination(43, 93, 0, expired)).toBeNull();
  });

  it("returns null for a non-finite coordinate", () => {
    const date = new Date(Date.UTC(2025, 0, 1, 0, 0, 0));
    expect(getMagneticDeclination(Number.NaN, 93, 0, date)).toBeNull();
  });
});
