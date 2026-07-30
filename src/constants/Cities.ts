/**
 * Artifact version of the cities pack, matching its `meta.version` row and its CDN
 * path. Bump to v2, v3, … with every upload — `bun run build:cities` prints the value
 * and the path to use.
 */
export const CITIES_PACK_VERSION = "v1" as const;

export const CITIES_CDN_BASE = "https://cdn.nedaa.dev/cities" as const;

/** Compressed size of the full pack, disclosed to the user before any download starts. */
export const CITIES_PACK_BYTES = 6_073_000;

export const CITIES_SEED_CITY_COUNT = 2500;
export const CITIES_FULL_CITY_COUNT = 69537;

/**
 * Latitude degrees searched around a point when resolving the nearest city. The window
 * doubles until a city is found or the maximum is passed, so a rural coordinate still
 * resolves without every lookup scanning a continent.
 */
export const NEAREST_CITY_INITIAL_DEGREES = 0.75;
export const NEAREST_CITY_MAX_DEGREES = 6;
