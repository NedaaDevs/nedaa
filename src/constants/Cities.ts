/**
 * Matches the `meta.version` row in the uploaded pack. Bump this together with every
 * upload — `bun run build:cities` prints the value and the CDN path to use.
 */
export const CITIES_PACK_VERSION = "2026-07-29" as const;

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
