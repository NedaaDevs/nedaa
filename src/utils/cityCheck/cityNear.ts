import { CITY_ROW_TRUST_KM } from "@/constants/CityCheck";
import { CitiesDB } from "@/services/cities-db";
import type { CitySearchResult } from "@/types/cities";
import type { Coords } from "@/types/location";
import { AppLogger } from "@/utils/appLogger";

const log = AppLogger.create("location");

/** The nearest city row within `CITY_ROW_TRUST_KM`; null when none or on a failure. */
export const trustedCityNear = async (point: Coords): Promise<CitySearchResult | null> => {
  try {
    const nearest = await CitiesDB.findNearestCity(point.latitude, point.longitude);
    return nearest && nearest.distanceKm <= CITY_ROW_TRUST_KM ? nearest.city : null;
  } catch {
    // The error's text may hold the point.
    log.w("CityCheck", "city row lookup failed");
    return null;
  }
};
