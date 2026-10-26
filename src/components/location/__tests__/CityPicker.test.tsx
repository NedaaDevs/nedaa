import { AccessibilityInfo } from "react-native";
import { act, screen, userEvent } from "@testing-library/react-native";

import { CITIES_PACK_PART } from "@/components/location/CitiesPackRow";
import CityPicker, { CITY_PICKER_PART } from "@/components/location/CityPicker";
import { CITY_SEARCH_STATUS, type CitySearchStatus } from "@/constants/Cities";
import { E2E_ID } from "@/constants/E2E";
import { UPDATE_START, UPDATE_STEP } from "@/constants/Location";
import { AppLocale } from "@/enums/app";
import i18n from "@/localization/i18n";
import { useCitySearch, type CitySearchState } from "@/hooks/useCitySearch";
import { useCitiesPackStore } from "@/stores/citiesPack";
import { useLocationUpdateStore } from "@/stores/locationUpdate";
import { renderWithTheme } from "@/test-helpers/theme";
import type { CitySearchResult } from "@/types/cities";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("@gorhom/bottom-sheet", () => jest.requireActual("@/test-helpers/bottomSheetMock"));
jest.mock("@/hooks/useHaptic", () => jest.requireActual("@/test-helpers/hapticMock"));
jest.mock("@/hooks/useCitySearch", () => ({ useCitySearch: jest.fn() }));
jest.mock("@/services/cities-download", () => ({ downloadCitiesPack: jest.fn() }));
jest.mock("@/services/cities-db", () => ({
  isFullPackInstalled: () => false,
  invalidateCitiesDb: jest.fn(),
}));

const t = i18n.t.bind(i18n);
const NO_NAMES = { ar: null, ur: null, ms: null };

const city = (gid: number, name: string, ar: string | null = null): CitySearchResult => ({
  gid,
  name,
  names: { ...NO_NAMES, ar },
  latitude: 24.68773,
  longitude: 46.72185,
  countryCode: "SA",
  country: { name: "Saudi Arabia", names: { ...NO_NAMES, ar: "السعودية" } },
  region: null,
  population: 1,
  timezone: "Asia/Riyadh",
});

const FIRST = city(1, "First", "الأولى");
const SECOND = city(2, "Second");

const setQuery = jest.fn();
const retry = jest.fn();

const search = (
  status: CitySearchStatus,
  results: CitySearchResult[] = [],
  offersFullPack = false
): CitySearchState => ({
  query: status === CITY_SEARCH_STATUS.IDLE ? "" : "Fi",
  setQuery,
  results,
  status,
  foundNothing: status === CITY_SEARCH_STATUS.DONE && results.length === 0,
  reachedLimit: false,
  retry,
  offersFullPack,
});

const showing = (state: CitySearchState) => jest.mocked(useCitySearch).mockReturnValue(state);

const renderPicker = async ({ isRTL = false } = {}) => {
  const handlers = { onPick: jest.fn(), onEnterCoordinates: jest.fn() };
  await renderWithTheme(<CityPicker {...handlers} />, { isRTL });
  return handlers;
};

const rows = () => screen.queryAllByTestId(E2E_ID.CITY_RESULT);
const announced = () => jest.mocked(AccessibilityInfo.announceForAccessibility).mock.calls;
const coordinatesLink = () =>
  screen.queryByRole("button", { name: t("location.picker.enterCoordinates") });

beforeEach(async () => {
  jest.clearAllMocks();
  jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => {});
  await act(() => i18n.changeLanguage(AppLocale.EN));
  showing(search(CITY_SEARCH_STATUS.DONE, [FIRST, SECOND]));
  useLocationUpdateStore.setState({ run: null });
  useCitiesPackStore.setState({ isDownloading: false, error: null });
});

afterEach(() => jest.restoreAllMocks());

describe("CityPicker, as the CI flows reach it", () => {
  it("searches what is typed into the field they fill", async () => {
    showing(search(CITY_SEARCH_STATUS.IDLE));
    await renderPicker();

    await userEvent.type(screen.getByTestId(E2E_ID.CITY_SEARCH_INPUT), "R");

    expect(setQuery).toHaveBeenLastCalledWith("R");
  });

  it("hands the city of the first result row they tap to its host", async () => {
    const { onPick } = await renderPicker();

    expect(rows()).toHaveLength(2);
    await userEvent.press(rows()[0]);

    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith(
      expect.objectContaining({ cityId: FIRST.gid, name: FIRST.name, timezone: "Asia/Riyadh" })
    );
  });
});

describe("CityPicker's search states", () => {
  it("asks for a city's name before anything is typed", async () => {
    showing(search(CITY_SEARCH_STATUS.IDLE));
    await renderPicker();

    expect(screen.getByTestId(CITY_PICKER_PART.PROMPT)).toBeTruthy();
    expect(screen.getByText(t("location.picker.promptTitle"))).toBeTruthy();
    expect(screen.getByText(t("location.picker.searchExample"))).toBeTruthy();
    expect(rows()).toHaveLength(0);
    expect(announced()).toEqual([]);
  });

  it("holds the rows' place while the first search runs", async () => {
    showing(search(CITY_SEARCH_STATUS.SEARCHING));
    await renderPicker();

    expect(screen.getByText(t("location.picker.searching"))).toBeTruthy();
    expect(
      screen.getAllByTestId(CITY_PICKER_PART.SKELETON, { includeHiddenElements: true })
    ).toHaveLength(2);
    // The placeholders are drawn, never read.
    expect(screen.queryAllByTestId(CITY_PICKER_PART.SKELETON)).toHaveLength(0);
    expect(announced()).toEqual([]);
  });

  it("keeps the last rows on screen while the next search runs", async () => {
    showing(search(CITY_SEARCH_STATUS.SEARCHING, [FIRST]));
    await renderPicker();

    expect(rows()).toHaveLength(1);
    expect(screen.getByText(t("location.picker.searching"))).toBeTruthy();
    expect(
      screen.queryAllByTestId(CITY_PICKER_PART.SKELETON, { includeHiddenElements: true })
    ).toHaveLength(0);
  });

  it("says how many cities a search found", async () => {
    await renderPicker();

    expect(announced()).toEqual([[t("location.picker.resultCount", { count: 2 })]]);
    expect(screen.queryByText(t("location.picker.searching"))).toBeNull();
  });

  it("offers coordinates in place when no city has the name", async () => {
    showing(search(CITY_SEARCH_STATUS.DONE, []));
    const { onEnterCoordinates } = await renderPicker();

    expect(screen.getByTestId(CITY_PICKER_PART.NONE)).toBeTruthy();
    expect(screen.getByText(t("location.picker.noneHint"))).toBeTruthy();
    expect(announced()).toEqual([[t("location.picker.noneTitle")]]);

    // One way to coordinates: the panel's own button.
    const ways = screen.getAllByRole("button", { name: t("location.picker.enterCoordinates") });
    expect(ways).toHaveLength(1);
    await userEvent.press(ways[0]);
    expect(onEnterCoordinates).toHaveBeenCalledTimes(1);
  });

  // Each keystroke after a miss searches again; the note and its button hold.
  it("keeps the no-city note while a longer name is searched", async () => {
    showing(search(CITY_SEARCH_STATUS.DONE, []));
    const handlers = await renderPicker();
    showing({ ...search(CITY_SEARCH_STATUS.SEARCHING), foundNothing: true });

    for (const letter of ["x", "y"]) {
      await userEvent.type(screen.getByTestId(E2E_ID.CITY_SEARCH_INPUT), letter);
      await screen.rerender(<CityPicker {...handlers} />);

      expect(screen.getByTestId(CITY_PICKER_PART.NONE)).toBeTruthy();
      expect(
        screen.queryAllByTestId(CITY_PICKER_PART.SKELETON, { includeHiddenElements: true })
      ).toHaveLength(0);
      expect(
        screen.getAllByRole("button", { name: t("location.picker.enterCoordinates") })
      ).toHaveLength(1);
    }
    expect(announced()).toEqual([[t("location.picker.noneTitle")]]);
  });

  // The rows stop at the search's limit; a listener cannot see that.
  it("says the list shows only the first cities when more may match", async () => {
    showing({ ...search(CITY_SEARCH_STATUS.DONE, [FIRST, SECOND]), reachedLimit: true });
    await renderPicker();

    const capped = t("location.picker.resultCountCapped", { count: 2 });
    expect(capped).not.toBe(t("location.picker.resultCount", { count: 2 }));
    expect(announced()).toEqual([[capped]]);
  });

  it("says the search failed, in words, and searches again on retry", async () => {
    showing(search(CITY_SEARCH_STATUS.FAILED));
    await renderPicker();

    expect(
      screen.getByLabelText(
        `${t("location.picker.searchFailed.title")}. ${t("location.picker.searchFailed.body")}`
      )
    ).toBeTruthy();
    await userEvent.press(screen.getByRole("button", { name: t("common.retry") }));

    expect(retry).toHaveBeenCalledTimes(1);
    expect(rows()).toHaveLength(0);
  });

  it("leads to coordinates from under the list", async () => {
    const { onEnterCoordinates } = await renderPicker();

    const link = coordinatesLink();
    expect(link?.props.accessibilityHint).toBe(t("a11y.location.picker.enterCoordinatesHint"));
    await userEvent.press(link!);

    expect(onEnterCoordinates).toHaveBeenCalledTimes(1);
  });

  // The update in flight holds the place; a second pick would be dropped.
  it("holds its rows while an update runs", async () => {
    useLocationUpdateStore.setState({
      run: {
        start: { kind: UPDATE_START.DEVICE },
        step: UPDATE_STEP.PRAYER_TIMES,
        failed: false,
      },
    });
    const { onPick } = await renderPicker();

    expect(rows()[0]).toBeDisabled();
    await userEvent.press(rows()[0]);
    expect(onPick).not.toHaveBeenCalled();
  });
});

describe("CityPicker's full city list", () => {
  it("offers the full list while only the major cities are installed", async () => {
    showing(search(CITY_SEARCH_STATUS.DONE, [FIRST], true));
    await renderPicker();

    expect(screen.getByTestId(CITIES_PACK_PART.OFFER)).toBeTruthy();
  });

  it("offers nothing once the full list is installed", async () => {
    await renderPicker();

    expect(screen.queryByTestId(CITIES_PACK_PART.OFFER)).toBeNull();
  });
});

describe("CityPicker in Arabic", () => {
  it("names each city and says the count in Arabic", async () => {
    await act(() => i18n.changeLanguage(AppLocale.AR));
    await renderPicker({ isRTL: true });

    expect(rows()[0]).toHaveAccessibleName(t("a11y.join", { first: "الأولى", second: "السعودية" }));
    expect(announced()).toEqual([["عُثر على مدينتين"]]);
  });
});
