import { buildAladhanSections } from "@/components/AladhanSettings/sections";

import type { AladhanSettings } from "@/types/providers/aladhan";

const t = (key: string) => key;

const settings = {
  method: 3,
  madhab: 1,
  midnightMode: 0,
} as AladhanSettings;

const sectionsByKey = () => {
  const built = buildAladhanSections(settings, t);
  return Object.fromEntries(built.map((section) => [section.key, section]));
};

describe("buildAladhanSections", () => {
  test("builds the method, school and midnight sections in reading order", () => {
    expect(buildAladhanSections(settings, t).map((section) => section.key)).toEqual([
      "method",
      "school",
      "midnightMode",
    ]);
  });

  test("reflects the current settings as the selected value", () => {
    const sections = sectionsByKey();

    expect(sections.method.value).toBe("3");
    expect(sections.school.value).toBe("1");
    expect(sections.midnightMode.value).toBe("0");
  });

  test("maps a chosen method onto its settings patch", () => {
    expect(sectionsByKey().method.apply("5")).toEqual({ method: 5 });
  });

  test("maps a chosen school onto madhab", () => {
    expect(sectionsByKey().school.apply("0")).toEqual({ madhab: 0 });
  });

  test("maps a chosen midnight mode onto midnightMode", () => {
    expect(sectionsByKey().midnightMode.apply("1")).toEqual({ midnightMode: 1 });
  });

  test("ignores an id that is not a known option", () => {
    expect(sectionsByKey().method.apply("999")).toBeNull();
    expect(sectionsByKey().school.apply("7")).toBeNull();
  });

  test("ignores a non-numeric value", () => {
    expect(sectionsByKey().method.apply("")).toBeNull();
  });

  test("offers every configured method as an option", () => {
    expect(sectionsByKey().method.items).toHaveLength(23);
  });

  test("renders an unset value as an empty selection", () => {
    const sections = buildAladhanSections({} as AladhanSettings, t);

    expect(sections.every((section) => section.value === "")).toBe(true);
  });
});
