import { AppLocale } from "@/enums/app";
import { useAppStore } from "@/stores/app";
import { useLocationStore } from "@/stores/location";
import type { ReverseGeocodeParams, ReverseGeocodeResponse } from "@/types/geocode";
import type { ManualLocation } from "@/types/location";

jest.mock("expo-sqlite/kv-store", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
  },
}));

const DUBAI_CITY: ManualLocation = {
  cityId: 292223,
  name: "Dubai",
  names: { ar: "دبي", ur: null, ms: null },
  region: null,
  countryCode: "AE",
  country: { name: "United Arab Emirates", names: { ar: "الإمارات", ur: null, ms: null } },
  latitude: 25.07725,
  longitude: 55.30927,
  timezone: "Asia/Dubai",
};

const NAMES: Record<string, { city: string; countryName: string }> = {
  [AppLocale.AR]: { city: "الرياض", countryName: "السعودية" },
  [AppLocale.EN]: { city: "Riyadh", countryName: "Saudi Arabia" },
};

/** Each lookup waits for the test to answer, so answers land in any order. */
const pending = new Map<string, () => void>();
const reverseGeocode = jest.fn(
  (params: ReverseGeocodeParams) =>
    new Promise<ReverseGeocodeResponse>((resolve) => {
      pending.set(params.locale, () =>
        resolve({ ...NAMES[params.locale], timezone: "Asia/Riyadh" })
      );
    })
);

const lookUpIn = (locale: AppLocale) => {
  useAppStore.setState({ locale });
  return useLocationStore.getState().updateAddressTranslation();
};

describe("updateAddressTranslation", () => {
  beforeEach(() => {
    pending.clear();
    useLocationStore.setState({ localizedLocation: { city: "", country: "" }, reverseGeocode });
  });

  // Arabic then English in quick succession; the Arabic answer arrives last.
  it("drops an answer for a language no longer in use", async () => {
    const arabic = lookUpIn(AppLocale.AR);
    const english = lookUpIn(AppLocale.EN);

    pending.get(AppLocale.EN)?.();
    await english;
    pending.get(AppLocale.AR)?.();
    await arabic;

    expect(useLocationStore.getState().localizedLocation).toEqual({
      city: "Riyadh",
      country: "Saudi Arabia",
    });
  });

  it("keeps an answer for the language in use", async () => {
    const arabic = lookUpIn(AppLocale.AR);

    pending.get(AppLocale.AR)?.();

    await expect(arabic).resolves.toBe(true);
    expect(useLocationStore.getState().localizedLocation.city).toBe("الرياض");
  });

  it("drops an answer for a place replaced while it was asked", async () => {
    const arabic = lookUpIn(AppLocale.AR);
    useLocationStore.getState().setManualLocation(DUBAI_CITY);

    pending.get(AppLocale.AR)?.();

    await expect(arabic).resolves.toBe(false);
    expect(useLocationStore.getState().localizedLocation).toEqual({
      city: DUBAI_CITY.name,
      country: DUBAI_CITY.country.name,
    });
    expect(useLocationStore.getState().locationDetails.timezone).toBe(DUBAI_CITY.timezone);
  });
});
