import { parseCoordinate, CoordinateAxis } from "@/utils/cities";

const { LATITUDE, LONGITUDE } = CoordinateAxis;

describe("parseCoordinate", () => {
  test("accepts a decimal latitude in range", () => {
    expect(parseCoordinate("24.68773", LATITUDE)).toBe(24.68773);
  });

  test("accepts a negative longitude", () => {
    expect(parseCoordinate("-1.89983", LONGITUDE)).toBe(-1.89983);
  });

  test("accepts an explicit plus sign", () => {
    expect(parseCoordinate("+24.5", LATITUDE)).toBe(24.5);
  });

  test("accepts a whole number", () => {
    expect(parseCoordinate("24", LATITUDE)).toBe(24);
  });

  test("ignores surrounding whitespace", () => {
    expect(parseCoordinate("  24.5  ", LATITUDE)).toBe(24.5);
  });

  test("accepts the exact pole and antimeridian limits", () => {
    expect(parseCoordinate("90", LATITUDE)).toBe(90);
    expect(parseCoordinate("-90", LATITUDE)).toBe(-90);
    expect(parseCoordinate("180", LONGITUDE)).toBe(180);
    expect(parseCoordinate("-180", LONGITUDE)).toBe(-180);
  });

  test("accepts Arabic-Indic digits so an Arabic keyboard works", () => {
    expect(parseCoordinate("٢٤.٥", LATITUDE)).toBe(24.5);
  });

  test("accepts extended Arabic-Indic digits used by Urdu keyboards", () => {
    expect(parseCoordinate("۲۴.۵", LATITUDE)).toBe(24.5);
  });

  test("accepts the Arabic decimal separator", () => {
    expect(parseCoordinate("٢٤٫٥", LATITUDE)).toBe(24.5);
  });

  test("rejects a latitude beyond the poles", () => {
    expect(parseCoordinate("91", LATITUDE)).toBeNull();
    expect(parseCoordinate("-90.1", LATITUDE)).toBeNull();
  });

  test("rejects a longitude beyond the antimeridian", () => {
    expect(parseCoordinate("181", LONGITUDE)).toBeNull();
  });

  test("treats 100 as valid longitude but invalid latitude", () => {
    expect(parseCoordinate("100", LONGITUDE)).toBe(100);
    expect(parseCoordinate("100", LATITUDE)).toBeNull();
  });

  test("rejects text that is not a number", () => {
    expect(parseCoordinate("north", LATITUDE)).toBeNull();
    expect(parseCoordinate("", LATITUDE)).toBeNull();
    expect(parseCoordinate("24.5.6", LATITUDE)).toBeNull();
    expect(parseCoordinate("24,5", LATITUDE)).toBeNull();
  });

  test("rejects a partially typed value rather than guessing", () => {
    expect(parseCoordinate("-", LATITUDE)).toBeNull();
    expect(parseCoordinate("24.", LATITUDE)).toBeNull();
  });
});
