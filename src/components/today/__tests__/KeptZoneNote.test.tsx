import { act, screen, waitFor } from "@testing-library/react-native";

import { KeptZoneNote, newestKept } from "@/components/today/KeptZoneNote";
import { KEPT_MAX_AGE_MS } from "@/constants/CityCheck";
import { AppLocale } from "@/enums/app";
import i18n from "@/localization/i18n";
import { EMPTY_MEMORY, useCityCheckStore } from "@/stores/cityCheck";
import { useLocationStore } from "@/stores/location";
import { offerUp } from "@/test-helpers/cityOffer";
import {
  JEDDAH_PLACE,
  savedRiyadh,
  t,
  writePlace,
  type WrittenPlace,
} from "@/test-helpers/cityOfferCard";
import { DUBAI_CITY, RIYADH_CITY } from "@/test-helpers/place";
import { renderWithTheme } from "@/test-helpers/theme";
import type { CitySearchResult } from "@/types/cities";
import type { PlaceMark } from "@/types/cityCheck";
import { readPhoneZone } from "@/utils/phoneZone";

const mockTrustedCityNear = jest.fn();

jest.mock("@/utils/cityCheck/cityNear", () => ({
  trustedCityNear: (...args: unknown[]) => mockTrustedCityNear(...args),
}));
jest.mock("@/utils/phoneZone", () => ({ readPhoneZone: jest.fn() }));

const NOW = Date.UTC(2026, 0, 15, 12);
const rowOf = (city: typeof DUBAI_CITY): CitySearchResult => ({
  gid: city.cityId ?? 0,
  name: city.name,
  names: city.names,
  latitude: city.latitude,
  longitude: city.longitude,
  countryCode: city.countryCode,
  country: city.country,
  region: null,
  population: 1_000_000,
  timezone: city.timezone,
});
const markOf = (city: typeof DUBAI_CITY, at = NOW): PlaceMark => ({
  lat: city.latitude,
  lng: city.longitude,
  at,
});

const DUBAI_ROW = rowOf(DUBAI_CITY);
const DUBAI_MARK = markOf(DUBAI_CITY);
const KUWAIT_CITY = { ...DUBAI_CITY, cityId: 1, name: "Kuwait", timezone: "Asia/Kuwait" };
const KUWAIT_ROW = rowOf(KUWAIT_CITY);
const KUWAIT_MARK = markOf(KUWAIT_CITY);
const TOKYO: WrittenPlace = {
  city: "Tokyo",
  country: "Japan",
  coords: { latitude: 35.68, longitude: 139.69 },
  zone: "Asia/Tokyo",
};
const RIYADH_PLACE: WrittenPlace = { ...JEDDAH_PLACE, city: RIYADH_CITY.name };

/** Any zone note, whichever way it reads. */
const NOTE_TEXT = /^Times are for /;

const DUBAI_NOTE = () =>
  t("location.zone.note.behind.hours", { count: 1, saved: "Riyadh", place: "Dubai" });

/** Stores a kept trip and makes its point resolve to `row`. */
const keepAt = (mark: PlaceMark, row: CitySearchResult) => {
  useCityCheckStore.getState().keep(mark);
  mockTrustedCityNear.mockResolvedValue(row);
};
const savedPlaceAt = (place: WrittenPlace) => writePlace(place, { settled: true });

const renderNote = () => renderWithTheme(<KeptZoneNote />);

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date(NOW) });
  jest.clearAllMocks();
  mockTrustedCityNear.mockResolvedValue(null);
  jest.mocked(readPhoneZone).mockReturnValue("Asia/Riyadh");
  await act(() => i18n.changeLanguage(AppLocale.EN));
  savedRiyadh();
  savedPlaceAt(RIYADH_PLACE);
  useCityCheckStore.setState({ cityCheck: EMPTY_MEMORY });
});
afterEach(() => jest.useRealTimers());

describe("KeptZoneNote", () => {
  it("says how far the kept place's clock is from the saved place's", async () => {
    keepAt(DUBAI_MARK, DUBAI_ROW);
    await renderNote();

    expect(await screen.findByText(DUBAI_NOTE())).toBeTruthy();
  });

  it("compares the two places' zones, not the phone's", async () => {
    jest.mocked(readPhoneZone).mockReturnValue("Asia/Dubai");
    savedPlaceAt(TOKYO);
    keepAt(DUBAI_MARK, DUBAI_ROW);
    await renderNote();

    expect(
      await screen.findByText(
        t("location.zone.note.ahead.hours", { count: 5, saved: "Tokyo", place: "Dubai" })
      )
    ).toBeTruthy();
    expect(readPhoneZone).not.toHaveBeenCalled();
  });

  it("says nothing while the two places share a clock", async () => {
    keepAt(KUWAIT_MARK, KUWAIT_ROW);
    await renderNote();

    await waitFor(() => expect(mockTrustedCityNear).toHaveBeenCalled());
    expect(screen.queryByText(NOTE_TEXT)).toBeNull();
  });

  it("says nothing while the offer card is up", async () => {
    keepAt(DUBAI_MARK, DUBAI_ROW);
    offerUp();
    await renderNote();
    await act(async () => {});

    expect(screen.queryByText(NOTE_TEXT)).toBeNull();
  });

  it.each<[string, () => void]>([
    [
      "the trip is older than its limit",
      () => keepAt({ ...DUBAI_MARK, at: NOW - KEPT_MAX_AGE_MS - 1 }, DUBAI_ROW),
    ],
    [
      "the city is chosen by hand",
      () => {
        keepAt(DUBAI_MARK, DUBAI_ROW);
        useLocationStore.getState().setManualLocation(RIYADH_CITY);
      },
    ],
    ["no trip is kept", () => {}],
  ])("says nothing when %s", async (_case, arrange) => {
    arrange();
    await renderNote();
    await act(async () => {});

    expect(screen.queryByText(NOTE_TEXT)).toBeNull();
  });

  it("reads as one text with no role", async () => {
    keepAt(DUBAI_MARK, DUBAI_ROW);
    await renderNote();
    const note = await screen.findByText(DUBAI_NOTE());

    expect(note.props.accessibilityRole).toBeUndefined();
  });
});

describe("newestKept", () => {
  const MARKS: PlaceMark[] = [
    { lat: 1, lng: 1, at: NOW - KEPT_MAX_AGE_MS - 1 },
    { lat: 2, lng: 2, at: NOW - 1_000 },
    { lat: 3, lng: 3, at: NOW - 2_000 },
  ];

  it("picks the newest kept trip still in its limit", () =>
    expect(newestKept([MARKS[0], MARKS[2], MARKS[1]], NOW)).toEqual(MARKS[1]));

  it("picks nothing when every trip is over", () => expect(newestKept([MARKS[0]], NOW)).toBeNull());
});
