/** Non-English app locales that have stored city names; English is the base name. */
export const CITY_LANGS = ["ar", "ur", "ms"] as const;
export type CityLang = (typeof CITY_LANGS)[number];

export type LocalizedNames = Record<CityLang, string | null>;

export type CityRegion = {
  code: string;
  name: string;
  names: LocalizedNames;
};

export type CityCountry = {
  name: string;
  names: LocalizedNames;
};

export type CityRecord = {
  gid: number;
  name: string;
  latitude: number;
  longitude: number;
  countryCode: string;
  country: CityCountry;
  region: CityRegion | null;
  population: number;
  timezone: string;
};

export type CitySearchResult = CityRecord & {
  names: LocalizedNames;
};

/** How far a resolved city sits from the coordinates it was resolved for. */
export type NearestCity = {
  city: CitySearchResult;
  distanceKm: number;
};

/** Which tier of the cities database is installed and in use. */
export const CitiesTier = {
  SEED: "seed",
  FULL: "full",
} as const;

export type CitiesTierValue = (typeof CitiesTier)[keyof typeof CitiesTier];
