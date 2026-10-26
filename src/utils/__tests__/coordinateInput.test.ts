import { COORDINATE_PROBLEM } from "@/constants/Cities";
import {
  readCoordinate,
  toAsciiNumerals,
  CoordinateAxis,
  type CoordinateAxisValue,
} from "@/utils/cities";

const { LATITUDE, LONGITUDE } = CoordinateAxis;

const value = (text: string, axis: CoordinateAxisValue = LATITUDE) => {
  const reading = readCoordinate(text, axis);
  return "value" in reading ? reading.value : null;
};
const problem = (text: string, axis: CoordinateAxisValue = LATITUDE) => {
  const reading = readCoordinate(text, axis);
  return "problem" in reading ? reading.problem : null;
};

describe("readCoordinate", () => {
  test("accepts a decimal latitude in range", () => {
    expect(value("24.68773")).toBe(24.68773);
  });

  test("accepts a negative longitude", () => {
    expect(value("-1.89983", LONGITUDE)).toBe(-1.89983);
  });

  test("accepts an explicit plus sign", () => {
    expect(value("+24.5")).toBe(24.5);
  });

  test("accepts a whole number", () => {
    expect(value("24")).toBe(24);
  });

  test("ignores surrounding whitespace", () => {
    expect(value("  24.5  ")).toBe(24.5);
  });

  test("accepts the exact pole and antimeridian limits", () => {
    expect(value("90")).toBe(90);
    expect(value("-90")).toBe(-90);
    expect(value("180", LONGITUDE)).toBe(180);
    expect(value("-180", LONGITUDE)).toBe(-180);
  });

  test("accepts Arabic-Indic digits so an Arabic keyboard works", () => {
    expect(value("٢٤.٥")).toBe(24.5);
  });

  test("accepts extended Arabic-Indic digits used by Urdu keyboards", () => {
    expect(value("۲۴.۵")).toBe(24.5);
  });

  test("accepts the Arabic decimal separator", () => {
    expect(value("٢٤٫٥")).toBe(24.5);
  });

  test("names a latitude beyond the poles out of range", () => {
    expect(problem("91")).toBe(COORDINATE_PROBLEM.OUT_OF_RANGE);
    expect(problem("-90.1")).toBe(COORDINATE_PROBLEM.OUT_OF_RANGE);
  });

  test("names a longitude beyond the antimeridian out of range", () => {
    expect(problem("181", LONGITUDE)).toBe(COORDINATE_PROBLEM.OUT_OF_RANGE);
  });

  test("treats 100 as valid longitude but out-of-range latitude", () => {
    expect(value("100", LONGITUDE)).toBe(100);
    expect(problem("100")).toBe(COORDINATE_PROBLEM.OUT_OF_RANGE);
  });

  test("names text that is not a number", () => {
    expect(problem("north")).toBe(COORDINATE_PROBLEM.NOT_A_NUMBER);
    expect(problem("24.5.6")).toBe(COORDINATE_PROBLEM.NOT_A_NUMBER);
    expect(problem("24,5")).toBe(COORDINATE_PROBLEM.NOT_A_NUMBER);
    expect(problem("٢٤٫٥٫٦")).toBe(COORDINATE_PROBLEM.NOT_A_NUMBER);
  });

  // A field part-way typed is not wrong yet, so it shows no error.
  test("holds a partially typed or empty value as incomplete rather than guessing", () => {
    expect(problem("")).toBe(COORDINATE_PROBLEM.INCOMPLETE);
    expect(problem("-")).toBe(COORDINATE_PROBLEM.INCOMPLETE);
    expect(problem("24.")).toBe(COORDINATE_PROBLEM.INCOMPLETE);
    expect(problem("٢٤٫")).toBe(COORDINATE_PROBLEM.INCOMPLETE);
    expect(value("-")).toBeNull();
    expect(value("24.")).toBeNull();
  });
});

describe("toAsciiNumerals", () => {
  test("writes Arabic-Indic digits and the Arabic decimal mark as Western", () => {
    expect(toAsciiNumerals("-٢١٫٤٢٢٥")).toBe("-21.4225");
    expect(toAsciiNumerals("۳۹٫۸")).toBe("39.8");
  });

  test("leaves Western text as it is", () => {
    expect(toAsciiNumerals("39.8262")).toBe("39.8262");
  });
});
