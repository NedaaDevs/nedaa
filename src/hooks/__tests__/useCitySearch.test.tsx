import React from "react";
import renderer, { act } from "react-test-renderer";

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

type HookValue = ReturnType<typeof useCitySearch>;
const results: HookValue[] = [];
const Probe = () => {
  results.push(useCitySearch());
  return null;
};
const latest = () => results[results.length - 1];

let root: renderer.ReactTestRenderer | null = null;

const mountProbe = async () => {
  await act(async () => {
    root = renderer.create(<Probe />);
    await Promise.resolve();
  });
};

describe("useCitySearch", () => {
  beforeEach(async () => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    results.length = 0;
    mockSearch.mockResolvedValue([]);
    useCitiesPackStore.setState({ isInstalled: false });
    await mountProbe();
  });

  afterEach(async () => {
    if (root) {
      const current = root;
      root = null;
      await act(async () => {
        current.unmount();
      });
    }
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  const typeAndSettle = async (value: string) => {
    await act(async () => {
      latest().setQuery(value);
    });
    await act(async () => {
      jest.advanceTimersByTime(250);
      await Promise.resolve();
    });
  };

  test("does not query for a blank input", async () => {
    await typeAndSettle("   ");
    expect(mockSearch).not.toHaveBeenCalled();
    expect(latest().isSearching).toBe(false);
  });

  test("queries once for the settled value rather than per keystroke", async () => {
    await act(async () => {
      latest().setQuery("Ri");
      latest().setQuery("Riy");
      latest().setQuery("Riyadh");
    });
    await act(async () => {
      jest.advanceTimersByTime(250);
      await Promise.resolve();
    });

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
    expect(latest().results).toHaveLength(1);
    expect(latest().results[0].name).toBe("Riyadh");
  });

  test("clears results when the query is emptied", async () => {
    mockSearch.mockResolvedValue([city(1, "Riyadh")]);
    await typeAndSettle("Riyadh");
    await typeAndSettle("");

    expect(latest().results).toEqual([]);
  });

  test("recovers from a failed search without surfacing stale results", async () => {
    mockSearch.mockResolvedValueOnce([city(1, "Riyadh")]);
    await typeAndSettle("Riyadh");

    mockSearch.mockRejectedValueOnce(new Error("database closed"));
    await typeAndSettle("Lahore");

    expect(latest().results).toEqual([]);
    expect(latest().isSearching).toBe(false);
  });

  test("offers the full pack while only the seed is installed", () => {
    expect(latest().offersFullPack).toBe(true);
  });

  test("stops offering the full pack once it is installed", async () => {
    await act(async () => {
      useCitiesPackStore.setState({ isInstalled: true });
    });
    expect(latest().offersFullPack).toBe(false);
  });
});
