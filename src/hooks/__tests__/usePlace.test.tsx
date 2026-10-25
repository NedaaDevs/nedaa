import { act, renderHook } from "@testing-library/react-native";

import { usePlace } from "@/hooks/usePlace";
import { PLACE_UNKNOWN } from "@/constants/Location";
import { AppLocale } from "@/enums/app";
import i18n from "@/localization/i18n";
import { useLocationStore } from "@/stores/location";
import { LocationMode } from "@/enums/location";
import type { ManualLocation } from "@/types/location";

const LOCALIZED = { city: "الرياض", country: "السعودية" };
const ADDRESS = { city: "Riyadh", country: "Saudi Arabia" };
const NONE = { city: "", country: "" };

const setPlace = (
  localizedLocation: { city: string; country: string },
  address: { city: string; country: string } | null
) =>
  useLocationStore.setState({
    localizedLocation,
    locationDetails: { ...useLocationStore.getState().locationDetails, address },
  });

const RIYADH_CITY: ManualLocation = {
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

describe("usePlace", () => {
  beforeEach(async () => {
    await act(() => i18n.changeLanguage(AppLocale.EN));
    useLocationStore.setState({ locationMode: LocationMode.DEVICE, manualLocation: null });
  });

  // A chosen city holds each language's name; the store keeps the base one.
  it("names a chosen city in the app's language", async () => {
    useLocationStore.getState().setManualLocation(RIYADH_CITY);
    await act(() => i18n.changeLanguage(AppLocale.AR));

    const { result } = await renderHook(() => usePlace());

    expect(result.current).toEqual({
      city: "الرياض",
      country: "السعودية",
      name: i18n.t("place.name", { city: "الرياض", country: "السعودية" }),
    });
  });

  it("names the place in the app's language", async () => {
    setPlace(LOCALIZED, ADDRESS);

    const { result } = await renderHook(() => usePlace());

    expect(result.current).toEqual({
      city: LOCALIZED.city,
      country: LOCALIZED.country,
      name: i18n.t("place.name", LOCALIZED),
    });
  });

  // The store starts the localized name empty, not missing.
  it("falls back to the device address while the localized name is empty", async () => {
    setPlace(NONE, ADDRESS);

    const { result } = await renderHook(() => usePlace());

    expect(result.current).toEqual({
      city: ADDRESS.city,
      country: ADDRESS.country,
      name: i18n.t("place.name", ADDRESS),
    });
  });

  it.each([
    [{ city: "Riyadh", country: "" }, "Riyadh"],
    [{ city: "", country: "Saudi Arabia" }, "Saudi Arabia"],
  ])("names whichever part is known: %o", async (localized, name) => {
    setPlace(localized, null);

    const { result } = await renderHook(() => usePlace());

    expect(result.current.name).toBe(name);
  });

  // Mixing the two would set an Arabic city beside an English country.
  it("keeps the localized name whole when it has either part", async () => {
    setPlace({ city: LOCALIZED.city, country: "" }, ADDRESS);

    const { result } = await renderHook(() => usePlace());

    expect(result.current).toEqual({
      city: LOCALIZED.city,
      country: undefined,
      name: LOCALIZED.city,
    });
  });

  it("treats the store's unknown marker as no name", async () => {
    setPlace({ city: PLACE_UNKNOWN, country: PLACE_UNKNOWN }, ADDRESS);

    const { result } = await renderHook(() => usePlace());

    expect(result.current.name).toBe(i18n.t("place.name", ADDRESS));
  });

  it("drops an unknown part of a known place", async () => {
    setPlace({ city: PLACE_UNKNOWN, country: LOCALIZED.country }, null);

    const { result } = await renderHook(() => usePlace());

    expect(result.current).toEqual({
      city: undefined,
      country: LOCALIZED.country,
      name: LOCALIZED.country,
    });
  });

  it("knows no place before any is found", async () => {
    setPlace(NONE, null);

    const { result } = await renderHook(() => usePlace());

    expect(result.current).toEqual({ city: undefined, country: undefined, name: undefined });
  });
});
