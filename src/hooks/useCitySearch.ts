import { useEffect, useRef, useState } from "react";

// Services
import { CitiesDB } from "@/services/cities-db";
import { shouldOfferFullPack } from "@/services/citiesDbStrategy";

// Stores
import { useCitiesPackStore } from "@/stores/citiesPack";

// Types
import type { CitySearchResult } from "@/types/cities";

// Utils
import { AppLogger } from "@/utils/appLogger";

const log = AppLogger.create("location");

const SEARCH_DEBOUNCE_MS = 200;
const RESULT_LIMIT = 40;

export type CitySearchState = {
  query: string;
  setQuery: (query: string) => void;
  results: CitySearchResult[];
  isSearching: boolean;
  offersFullPack: boolean;
};

/** The query a result set belongs to, so results and progress can both be derived. */
type CompletedSearch = {
  query: string;
  results: CitySearchResult[];
};

const NOTHING_SEARCHED: CompletedSearch = { query: "", results: [] };

export const useCitySearch = (): CitySearchState => {
  const [query, setQuery] = useState("");
  const [completed, setCompleted] = useState<CompletedSearch>(NOTHING_SEARCHED);
  const isFullInstalled = useCitiesPackStore((state) => state.isInstalled);

  // Monotonic id so a slow response for an earlier query cannot overwrite a newer one.
  const requestIdRef = useRef(0);
  const trimmed = query.trim();

  useEffect(() => {
    if (!trimmed) {
      // Invalidate anything in flight so a late response cannot repopulate a cleared field.
      requestIdRef.current += 1;
      return;
    }

    const requestId = ++requestIdRef.current;
    const timer = setTimeout(async () => {
      let found: CitySearchResult[] = [];
      try {
        found = await CitiesDB.searchCities(trimmed, RESULT_LIMIT);
      } catch (error) {
        log.w("CitySearch", `search failed: ${(error as Error)?.message ?? error}`);
      }
      // Recording the query alongside its results is what lets both `results` and
      // `isSearching` be derived rather than tracked as separate state.
      if (requestIdRef.current === requestId) setCompleted({ query: trimmed, results: found });
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [trimmed]);

  const isCurrent = trimmed !== "" && completed.query === trimmed;

  return {
    query,
    setQuery,
    results: isCurrent ? completed.results : [],
    isSearching: trimmed !== "" && !isCurrent,
    offersFullPack: shouldOfferFullPack(isFullInstalled, completed.results.length),
  };
};
