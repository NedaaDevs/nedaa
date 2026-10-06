import arTranslations from "@/localization/locales/ar.json";
import { LITERAL_DIGIT_KEYS, numeralPostProcessor } from "@/localization/numerals";

const mockState = { useWesternNumerals: false };

jest.mock("@/stores/preferences", () => ({
  usePreferencesStore: {
    getState: () => ({ useWesternNumerals: mockState.useWesternNumerals }),
  },
}));

const ar = arTranslations as Record<string, unknown>;

const run = (key: string | string[], value: string, lng = "ar") =>
  numeralPostProcessor.process(value, key, { lng }, {});

const translate = (key: string, lng = "ar") => run(key, ar[key] as string, lng);

beforeEach(() => {
  mockState.useWesternNumerals = false;
});

describe("numeralPostProcessor", () => {
  it("applies the numeral preference to settings copy", () => {
    expect(translate("settings.summary.clock24")).toBe("نظام ٢٤ ساعة");
  });

  it("passes copy through when Western numerals are chosen", () => {
    mockState.useWesternNumerals = true;
    expect(translate("settings.summary.clock24")).toBe("نظام 24 ساعة");
  });

  it("leaves other locales untouched", () => {
    expect(run("settings.summary.clock24", "17:30 و 5:30", "en")).toBe("17:30 و 5:30");
  });

  it("leaves the Western numeral option in Western digits under Arabic numerals", () => {
    expect(translate("settings.preferences.numerals.options.western")).toBe("123");
  });

  it("leaves licence identifiers alone", () => {
    expect(translate("settings.acknowledgements.cities.body")).toContain("CC BY 4.0");
  });

  it("honours an excluded key passed as a fallback array", () => {
    expect(run(["settings.acknowledgements.cities.body", "some.other.key"], "CC BY 4.0")).toBe(
      "CC BY 4.0"
    );
  });

  it("returns non-string values untouched", () => {
    const list = ["a", "b"] as unknown as string;
    expect(numeralPostProcessor.process(list, "some.key", { lng: "ar" }, {})).toBe(list);
  });
});

const flatten = (value: unknown, path = ""): [string, string][] => {
  if (typeof value === "string") return [[path, value]];
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
      flatten(child, path ? `${path}.${key}` : key)
    );
  }
  return [];
};

// Scripture keeps the Arabic-Indic ayah markers it is written with.
const SCRIPTURE_KEYS = ["athkar.items."];

describe("ar.json digit storage", () => {
  it("stores Western digits everywhere the numeral preference should reach", () => {
    const exempt = [...SCRIPTURE_KEYS, ...LITERAL_DIGIT_KEYS];
    const offenders = flatten(ar)
      .filter(([, value]) => /[٠-٩]/.test(value))
      .map(([key]) => key)
      .filter((key) => !exempt.some((prefix) => key.startsWith(prefix)));

    expect(offenders).toEqual([]);
  });
});
