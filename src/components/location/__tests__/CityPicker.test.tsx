import { render, screen, userEvent } from "@testing-library/react-native";

import CityPicker from "@/components/location/CityPicker";
import { E2E_ID } from "@/constants/E2E";
import { useCitySearch, type CitySearchState } from "@/hooks/useCitySearch";
import { useLocationUpdate } from "@/hooks/useLocationUpdate";
import { ThemeProvider } from "@/test-helpers/theme";
import type { CitySearchResult } from "@/types/cities";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("@/hooks/useCitySearch", () => ({ useCitySearch: jest.fn() }));
jest.mock("@/hooks/useLocationUpdate", () => ({ useLocationUpdate: jest.fn() }));
jest.mock("@/stores/citiesPack", () => ({
  useCitiesPackStore: (select: (state: { refreshInstalled: () => void }) => unknown) =>
    select({ refreshInstalled: () => undefined }),
}));

const NO_NAMES = { ar: null, ur: null, ms: null };

const city = (gid: number, name: string): CitySearchResult => ({
  gid,
  name,
  names: NO_NAMES,
  latitude: 24.68773,
  longitude: 46.72185,
  countryCode: "SA",
  country: { name: "Saudi Arabia", names: NO_NAMES },
  region: null,
  population: 1,
  timezone: "Asia/Riyadh",
});

const FIRST = city(1, "First");
const SECOND = city(2, "Second");

const setQuery = jest.fn();
const applyManualLocation = jest.fn();

const search = (results: CitySearchResult[]): CitySearchState => ({
  query: "",
  setQuery,
  results,
  isSearching: false,
  offersFullPack: false,
});

beforeEach(() => {
  jest.mocked(useCitySearch).mockReturnValue(search([FIRST, SECOND]));
  applyManualLocation.mockReset().mockResolvedValue(true);
  jest.mocked(useLocationUpdate).mockReturnValue({
    updateState: { isUpdating: false, currentStep: null, error: null },
    applyManualLocation,
    executeUpdate: jest.fn(),
    switchToDevice: jest.fn(),
    retry: jest.fn(),
    dismissFailure: jest.fn(),
  });
});

const renderPicker = (onDone = jest.fn()) =>
  render(
    <ThemeProvider>
      <CityPicker onDone={onDone} />
    </ThemeProvider>
  );

describe("CityPicker, as the CI flows reach it", () => {
  it("searches what is typed into the field they fill", async () => {
    await renderPicker();

    await userEvent.type(screen.getByTestId(E2E_ID.CITY_SEARCH_INPUT), "R");

    expect(setQuery).toHaveBeenLastCalledWith("R");
  });

  it("applies the city of the first result row they tap", async () => {
    const onDone = jest.fn();
    await renderPicker(onDone);

    const rows = screen.getAllByTestId(E2E_ID.CITY_RESULT);
    expect(rows).toHaveLength(2);
    await userEvent.press(rows[0]);

    expect(applyManualLocation).toHaveBeenCalledWith(
      expect.objectContaining({ cityId: FIRST.gid, name: FIRST.name })
    );
    expect(onDone).toHaveBeenCalled();
  });
});
