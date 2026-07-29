import { LocationMode } from "@/enums/location";
import { CITY_LANGS, CitiesTier } from "@/types/cities";
import { AppLocale } from "@/enums/app";

describe("location mode", () => {
  test("exposes device and manual as string values", () => {
    expect(LocationMode.DEVICE).toBe("device");
    expect(LocationMode.MANUAL).toBe("manual");
  });
});

describe("cities tier", () => {
  test("exposes seed and full, matching the meta.tier values the build script writes", () => {
    expect(CitiesTier.SEED).toBe("seed");
    expect(CitiesTier.FULL).toBe("full");
  });
});

describe("city languages", () => {
  test("covers every app locale except English, which is the base name", () => {
    const nonEnglish = Object.values(AppLocale).filter((locale) => locale !== AppLocale.EN);
    expect([...CITY_LANGS].sort()).toEqual([...nonEnglish].sort());
  });
});
