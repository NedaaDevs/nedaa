import { act, renderHook } from "@testing-library/react-native";

import { CITY_SEARCH_STATUS } from "@/constants/Cities";
import { useCitySearch } from "@/hooks/useCitySearch";
import { CitiesDB } from "@/services/cities-db";
import { useCitiesPackStore } from "@/stores/citiesPack";
import type { CitySearchResult } from "@/types/cities";

jest.mock("@/services/cities-db", () => ({
  CitiesDB: { searchCities: jest.fn(() => Promise.resolve([])) },
}));

jest.mock("@/utils/appLogger", () => ({
  AppLogger: {
    create: () => ({ d: jest.fn(), i: jest.fn(), w: jest.fn(), e: jest.fn() }),
  },
}));

const mockSearch = CitiesDB.searchCities as jest.Mock;

const city = (gid: number, name: string): CitySearchResult => ({
  gid,
  name,
  names: { ar: null, ur: null, ms: null },
  latitude: 0,
  longitude: 0,
  countryCode: "GB",
  country: { name: "United Kingdom", names: { ar: null, ur: null, ms: null } },
  region: null,
  population: 1,
  timezone: "Europe/London",
});

const mountSearch = () => renderHook(() => useCitySearch());

let result: Awaited<ReturnType<typeof mountSearch>>["result"];

describe("useCitySearch", () => {
  beforeEach(async () => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockSearch.mockResolvedValue([]);
    useCitiesPackStore.setState({ isInstalled: false });
    ({ result } = await mountSearch());
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  const type = (value: string) =>
    act(async () => {
      result.current.setQuery(value);
    });

  /** Runs the debounce out and lets the search answer. */
  const settle = () =>
    act(async () => {
      jest.advanceTimersByTime(250);
      await Promise.resolve();
    });

  const typeAndSettle = async (value: string) => {
    await type(value);
    await settle();
  };

  test("does not query for a blank input", async () => {
    await typeAndSettle("   ");
    expect(mockSearch).not.toHaveBeenCalled();
    expect(result.current.status).toBe(CITY_SEARCH_STATUS.IDLE);
  });

  test("queries once for the settled value rather than per keystroke", async () => {
    await act(async () => {
      result.current.setQuery("Ri");
      result.current.setQuery("Riy");
      result.current.setQuery("Riyadh");
    });
    await settle();

    expect(mockSearch).toHaveBeenCalledTimes(1);
    expect(mockSearch).toHaveBeenCalledWith("Riyadh", expect.any(Number));
  });

  test("trims the query before searching", async () => {
    await typeAndSettle("  Riyadh  ");
    expect(mockSearch).toHaveBeenCalledWith("Riyadh", expect.any(Number));
  });

  test("exposes the results it finds", async () => {
    mockSearch.mockResolvedValue([city(1, "Riyadh")]);
    await typeAndSettle("Riyadh");
    expect(result.current.results).toHaveLength(1);
    expect(result.current.results[0].name).toBe("Riyadh");
  });

  test("clears results when the query is emptied", async () => {
    mockSearch.mockResolvedValue([city(1, "Riyadh")]);
    await typeAndSettle("Riyadh");
    await typeAndSettle("");

    expect(result.current.results).toEqual([]);
    expect(result.current.status).toBe(CITY_SEARCH_STATUS.IDLE);
  });

  test("reports a search that found nothing as done, with no rows", async () => {
    await typeAndSettle("Atlantis");

    expect(result.current.status).toBe(CITY_SEARCH_STATUS.DONE);
    expect(result.current.results).toEqual([]);
  });

  // The rows on screen stay put between keystrokes rather than flashing empty.
  test("keeps the last rows while the next search runs", async () => {
    mockSearch.mockResolvedValue([city(1, "Riyadh")]);
    await typeAndSettle("Ri");

    await type("Riy");

    expect(result.current.status).toBe(CITY_SEARCH_STATUS.SEARCHING);
    expect(result.current.results.map((found) => found.name)).toEqual(["Riyadh"]);
  });

  // A cleared field starts the next search from nothing, not the old rows.
  test("keeps no rows from before the field was cleared", async () => {
    mockSearch.mockResolvedValue([city(1, "Riyadh")]);
    await typeAndSettle("Riyadh");
    await typeAndSettle("");

    await type("J");

    expect(result.current.status).toBe(CITY_SEARCH_STATUS.SEARCHING);
    expect(result.current.results).toEqual([]);
  });

  test("reports a failed search without surfacing stale results", async () => {
    mockSearch.mockResolvedValueOnce([city(1, "Riyadh")]);
    await typeAndSettle("Riyadh");

    mockSearch.mockRejectedValueOnce(new Error("database closed"));
    await typeAndSettle("Lahore");

    expect(result.current.results).toEqual([]);
    expect(result.current.status).toBe(CITY_SEARCH_STATUS.FAILED);
  });

  test("searches the same text again on retry", async () => {
    mockSearch.mockRejectedValueOnce(new Error("database closed"));
    await typeAndSettle("Lahore");
    mockSearch.mockResolvedValueOnce([city(2, "Lahore")]);

    await act(async () => {
      result.current.retry();
    });
    expect(result.current.status).toBe(CITY_SEARCH_STATUS.SEARCHING);
    await settle();

    expect(mockSearch).toHaveBeenLastCalledWith("Lahore", expect.any(Number));
    expect(result.current.status).toBe(CITY_SEARCH_STATUS.DONE);
    expect(result.current.results.map((found) => found.name)).toEqual(["Lahore"]);
  });

  // The no-results note stays put while a longer name is searched.
  test("holds a search that found nothing while the next one runs", async () => {
    await typeAndSettle("Atlantis");
    expect(result.current.foundNothing).toBe(true);

    await type("Atlantisx");
    await type("Atlantisxy");

    expect(result.current.status).toBe(CITY_SEARCH_STATUS.SEARCHING);
    expect(result.current.foundNothing).toBe(true);
  });

  test("says nothing was found only after a search finds no city", async () => {
    await type("J");
    expect(result.current.foundNothing).toBe(false);

    mockSearch.mockResolvedValue([city(1, "Jeddah")]);
    await typeAndSettle("Jeddah");
    expect(result.current.foundNothing).toBe(false);

    mockSearch.mockRejectedValueOnce(new Error("database closed"));
    await typeAndSettle("Jeddahx");
    expect(result.current.foundNothing).toBe(false);
  });

  test("says when the rows stop at the search's limit", async () => {
    mockSearch.mockImplementation(async (_query: string, limit: number) =>
      Array.from({ length: limit }, (_, gid) => city(gid, `City ${gid}`))
    );
    await typeAndSettle("C");
    expect(result.current.reachedLimit).toBe(true);

    mockSearch.mockResolvedValue([city(1, "Cairo")]);
    await typeAndSettle("Cairo");
    expect(result.current.reachedLimit).toBe(false);
  });

  // The seed's answer is stale once the full list lands under it.
  test("searches the same text in the full list once it is installed", async () => {
    await typeAndSettle("Smalltown");
    mockSearch.mockResolvedValue([city(3, "Smalltown")]);

    await act(async () => {
      useCitiesPackStore.setState({ isInstalled: true });
    });
    expect(result.current.status).toBe(CITY_SEARCH_STATUS.SEARCHING);
    await settle();

    expect(mockSearch).toHaveBeenCalledTimes(2);
    expect(mockSearch).toHaveBeenLastCalledWith("Smalltown", expect.any(Number));
    expect(result.current.status).toBe(CITY_SEARCH_STATUS.DONE);
    expect(result.current.results.map((found) => found.name)).toEqual(["Smalltown"]);
  });

  test("offers the full pack while only the seed is installed", () => {
    expect(result.current.offersFullPack).toBe(true);
  });

  test("stops offering the full pack once it is installed", async () => {
    await act(async () => {
      useCitiesPackStore.setState({ isInstalled: true });
    });
    expect(result.current.offersFullPack).toBe(false);
  });
});
