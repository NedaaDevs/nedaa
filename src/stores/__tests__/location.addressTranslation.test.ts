import { AppLocale } from "@/enums/app";
import { useAppStore } from "@/stores/app";
import { useLocationStore } from "@/stores/location";
import type { ReverseGeocodeParams, ReverseGeocodeResponse } from "@/types/geocode";

jest.mock("expo-sqlite/kv-store", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
  },
}));

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
});
