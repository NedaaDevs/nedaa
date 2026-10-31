import { useEffect, useRef, useState } from "react";

// Constants
import { CITY_SEARCH_STATUS, type CitySearchStatus } from "@/constants/Cities";

// Services
import { CitiesDB } from "@/services/cities-db";
import { shouldOfferFullPack } from "@/services/citiesDbStrategy";

// Stores
import { useCitiesPackStore } from "@/stores/citiesPack";

// Types
import type { CitySearchResult } from "@/types/cities";

// Utils
import { AppLogger } from "@/utils/appLogger";
import { errorText } from "@/utils/errorText";

const log = AppLogger.create("location");

const SEARCH_DEBOUNCE_MS = 200;
const RESULT_LIMIT = 40;

export type CitySearchState = {
  query: string;
  setQuery: (query: string) => void;
  /** The last finished search's rows, kept while the next one runs. */
  results: CitySearchResult[];
  status: CitySearchStatus;
  /** The last finished search found no city; it holds while the next runs. */
  foundNothing: boolean;
  /** The rows stop at the search's limit, so more cities may match. */
  reachedLimit: boolean;
  /** Searches the same text again after a failure. */
  retry: () => void;
  offersFullPack: boolean;
};

/** A finished search and the text, attempt and city list it answered. */
type CompletedSearch = {
  query: string;
  attempt: number;
  fullInstalled: boolean;
  results: CitySearchResult[];
  failed: boolean;
};

const NOTHING_SEARCHED: CompletedSearch = {
  query: "",
  attempt: 0,
  fullInstalled: false,
  results: [],
  failed: false,
};

export const useCitySearch = (): CitySearchState => {
  const [query, setQueryText] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [completed, setCompleted] = useState<CompletedSearch>(NOTHING_SEARCHED);
  const isFullInstalled = useCitiesPackStore((state) => state.isInstalled);

  // A slow answer to an earlier query cannot overwrite a newer one.
  const requestIdRef = useRef(0);
  const trimmed = query.trim();

  useEffect(() => {
    if (!trimmed) {
      // A late answer cannot fill a cleared field.
      requestIdRef.current += 1;
      return;
    }

    const requestId = ++requestIdRef.current;
    const timer = setTimeout(async () => {
      let found: CitySearchResult[] = [];
      let failed = false;
      try {
        found = await CitiesDB.searchCities(trimmed, RESULT_LIMIT);
      } catch (error) {
        failed = true;
        log.w("CitySearch", `search failed: ${errorText(error)}`);
      }
      if (requestIdRef.current === requestId) {
        setCompleted({
          query: trimmed,
          attempt,
          fullInstalled: isFullInstalled,
          results: found,
          failed,
        });
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [trimmed, attempt, isFullInstalled]);

  // A cleared field forgets its rows, so the next search starts from none.
  const setQuery = (next: string) => {
    if (!next.trim()) setCompleted(NOTHING_SEARCHED);
    setQueryText(next);
  };

  // Installing the full list makes the seed's answer stale.
  const isCurrent =
    completed.query === trimmed &&
    completed.attempt === attempt &&
    completed.fullInstalled === isFullInstalled;
  const status: CitySearchStatus = !trimmed
    ? CITY_SEARCH_STATUS.IDLE
    : !isCurrent
      ? CITY_SEARCH_STATUS.SEARCHING
      : completed.failed
        ? CITY_SEARCH_STATUS.FAILED
        : CITY_SEARCH_STATUS.DONE;

  return {
    query,
    setQuery,
    results: trimmed ? completed.results : [],
    status,
    foundNothing:
      trimmed !== "" &&
      completed.query !== "" &&
      !completed.failed &&
      completed.results.length === 0,
    reachedLimit: completed.results.length >= RESULT_LIMIT,
    retry: () => setAttempt((count) => count + 1),
    offersFullPack: shouldOfferFullPack(isFullInstalled, completed.results.length),
  };
};
