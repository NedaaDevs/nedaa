import { act, renderHook, waitFor } from "@testing-library/react-native";

import { CITY_ROW_TRUST_KM } from "@/constants/CityCheck";
import { AppLocale } from "@/enums/app";
import { useMarkPlace } from "@/hooks/useMarkPlace";
import i18n from "@/localization/i18n";
import { useCitiesPackStore } from "@/stores/citiesPack";
import { JEDDAH_MARK, JEDDAH_ROW, MANAMA_ROW } from "@/test-helpers/cityRows";
import { RIYADH_ZONE } from "@/test-helpers/prayerDay";
import type { PlaceMark } from "@/types/cityCheck";

const mockFindNearestCity = jest.fn();

jest.mock("@/services/cities-db", () => ({
  CitiesDB: { findNearestCity: (...args: unknown[]) => mockFindNearestCity(...args) },
}));

const MANAMA_MARK: PlaceMark = { lat: MANAMA_ROW.latitude, lng: MANAMA_ROW.longitude, at: 3_000 };

beforeEach(async () => {
  mockFindNearestCity.mockReset();
  useCitiesPackStore.setState({ isInstalled: false });
  await act(() => i18n.changeLanguage(AppLocale.EN));
});

describe("useMarkPlace", () => {
  it("names a mark from a city row within the trust distance, in the app's language", async () => {
    await act(() => i18n.changeLanguage(AppLocale.AR));
    mockFindNearestCity.mockResolvedValue({ city: JEDDAH_ROW, distanceKm: 3 });

    const { result } = await renderHook(() => useMarkPlace(JEDDAH_MARK));

    await waitFor(() => expect(result.current).toEqual({ city: "جدة", zone: RIYADH_ZONE }));
    expect(mockFindNearestCity).toHaveBeenCalledWith(JEDDAH_MARK.lat, JEDDAH_MARK.lng);
  });

  it("names no city for a row farther off", async () => {
    mockFindNearestCity.mockResolvedValue({ city: JEDDAH_ROW, distanceKm: CITY_ROW_TRUST_KM + 1 });

    const { result } = await renderHook(() => useMarkPlace(JEDDAH_MARK));

    await waitFor(() => expect(result.current).toEqual({ city: null, zone: null }));
  });

  it("is undefined while it looks", async () => {
    mockFindNearestCity.mockReturnValue(new Promise(() => {}));

    const { result } = await renderHook(() => useMarkPlace(JEDDAH_MARK));

    expect(result.current).toBeUndefined();
  });

  it("shows only the answer for the mark it has now", async () => {
    let answerFirst: (value: unknown) => void = () => {};
    mockFindNearestCity
      .mockReturnValueOnce(new Promise((resolve) => (answerFirst = resolve)))
      .mockResolvedValueOnce({ city: MANAMA_ROW, distanceKm: 1 });

    const { result, rerender } = await renderHook(
      ({ mark }: { mark: PlaceMark }) => useMarkPlace(mark),
      { initialProps: { mark: JEDDAH_MARK } }
    );
    await rerender({ mark: MANAMA_MARK });
    await waitFor(() => expect(result.current).toEqual({ city: "Manama", zone: "Asia/Bahrain" }));

    await act(async () => answerFirst({ city: JEDDAH_ROW, distanceKm: 1 }));

    expect(result.current).toEqual({ city: "Manama", zone: "Asia/Bahrain" });
  });

  it("looks again only when the mark's point or date changes, not its object", async () => {
    mockFindNearestCity.mockResolvedValue({ city: JEDDAH_ROW, distanceKm: 1 });

    const { result, rerender } = await renderHook(
      ({ mark }: { mark: PlaceMark }) => useMarkPlace(mark),
      { initialProps: { mark: JEDDAH_MARK } }
    );
    await waitFor(() => expect(result.current?.city).toBe("Jeddah"));
    await rerender({ mark: { ...JEDDAH_MARK } });

    expect(mockFindNearestCity).toHaveBeenCalledTimes(1);
    expect(result.current?.city).toBe("Jeddah");
  });

  it("looks again once the full city pack installs", async () => {
    mockFindNearestCity
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ city: JEDDAH_ROW, distanceKm: 1 });

    const { result } = await renderHook(() => useMarkPlace(JEDDAH_MARK));
    await waitFor(() => expect(result.current).toEqual({ city: null, zone: null }));
    await act(async () => useCitiesPackStore.setState({ isInstalled: true }));

    await waitFor(() => expect(result.current?.city).toBe("Jeddah"));
  });

  it("is undefined for a new mark while it looks, not the last mark's place", async () => {
    mockFindNearestCity
      .mockResolvedValueOnce({ city: JEDDAH_ROW, distanceKm: 1 })
      .mockReturnValueOnce(new Promise(() => {}));

    const { result, rerender } = await renderHook(
      ({ mark }: { mark: PlaceMark }) => useMarkPlace(mark),
      { initialProps: { mark: JEDDAH_MARK } }
    );
    await waitFor(() => expect(result.current?.city).toBe("Jeddah"));

    await rerender({ mark: MANAMA_MARK });

    expect(result.current).toBeUndefined();
  });

  it("looks again for the same point at another date", async () => {
    mockFindNearestCity.mockResolvedValue({ city: JEDDAH_ROW, distanceKm: 1 });

    const { result, rerender } = await renderHook(
      ({ mark }: { mark: PlaceMark }) => useMarkPlace(mark),
      { initialProps: { mark: JEDDAH_MARK } }
    );
    await waitFor(() => expect(result.current?.city).toBe("Jeddah"));

    await rerender({ mark: { ...JEDDAH_MARK, at: JEDDAH_MARK.at + 1 } });

    expect(mockFindNearestCity).toHaveBeenCalledTimes(2);
  });
});
