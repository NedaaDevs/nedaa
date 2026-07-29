// Decisions for the cities-database open and download paths, kept pure so the service
// in cities-db.ts stays testable without native SQLite or the network.
import { CITIES_CDN_BASE } from "@/constants/Cities";
import { CitiesTier, type CitiesTierValue } from "@/types/cities";

export const activeTier = (fullInstalled: boolean): CitiesTierValue =>
  fullInstalled ? CitiesTier.FULL : CitiesTier.SEED;

/**
 * The download offer is a standing row rather than a reaction to an empty search, so a
 * user never has to discover it at the moment their city turns out to be missing. The
 * result count is accepted so callers can position the row without deciding visibility.
 */
export const shouldOfferFullPack = (fullInstalled: boolean, _resultCount: number): boolean =>
  !fullInstalled;

export const citiesPackUrl = (version: string): string =>
  `${CITIES_CDN_BASE}/${version}/cities.db.gz`;
