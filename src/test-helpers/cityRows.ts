import { COUNTRY_CODE } from "@/constants/aladhanMethods";
import { JEDDAH_CITY } from "@/test-helpers/place";
import type { CitySearchResult } from "@/types/cities";

/** Jeddah's city-list row, in Saudi Arabia's zone. */
export const JEDDAH_ROW: CitySearchResult = {
  gid: 105343,
  name: JEDDAH_CITY.name,
  names: JEDDAH_CITY.names,
  latitude: JEDDAH_CITY.latitude,
  longitude: JEDDAH_CITY.longitude,
  countryCode: JEDDAH_CITY.countryCode,
  country: JEDDAH_CITY.country,
  region: null,
  population: 2_867_446,
  timezone: JEDDAH_CITY.timezone,
};

/** Manama's city-list row, in Bahrain. */
export const MANAMA_ROW: CitySearchResult = {
  gid: 290340,
  name: "Manama",
  names: { ar: "المنامة", ur: null, ms: null },
  latitude: 26.2285,
  longitude: 50.586,
  countryCode: COUNTRY_CODE.BAHRAIN,
  country: { name: "Bahrain", names: { ar: "البحرين", ur: null, ms: null } },
  region: null,
  population: 147_074,
  timezone: "Asia/Bahrain",
};
