// Parsers for the GeoNames tab-separated dumps used to build the cities database.
// Kept in src/ so they run under jest, which excludes /scripts/; nothing in the app
// imports them, so Metro never bundles them.
import { CITY_LANGS, type CityLang } from "@/types/cities";

/** Column count of the `geoname` table layout shared by every cities dump. */
const CITY_FIELD_COUNT = 19;

// Zero-width and bidi control characters: ZWSP/ZWNJ/ZWJ, LRM/RLM, the embedding and
// isolate controls, and BOM. GeoNames names contain a scattering of these; they are
// invisible but break equality comparison and stray into text selection.
const INVISIBLE_MARKS = /[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;

/** A display-ready name: no invisible marks, no surrounding whitespace. */
export const sanitizeName = (value: string): string => value.replace(INVISIBLE_MARKS, "").trim();

export type ParsedCity = {
  gid: number;
  name: string;
  ascii: string | null;
  latitude: number;
  longitude: number;
  countryCode: string;
  admin1Code: string | null;
  population: number;
  timezone: string;
};

/**
 * One row of cities500/1000/5000/15000. Returns null for rows missing anything the
 * app depends on — a row without a timezone would compute prayer times against the
 * wrong day boundary, which fails with no visible error.
 */
export const parseCityLine = (line: string): ParsedCity | null => {
  const f = line.split("\t");
  if (f.length < CITY_FIELD_COUNT) return null;

  const gid = Number(f[0]);
  const latitude = Number(f[4]);
  const longitude = Number(f[5]);
  if (!Number.isFinite(gid) || !Number.isFinite(latitude) || !Number.isFinite(longitude))
    return null;
  if (!f[1] || !f[8] || !f[17]) return null;

  const name = sanitizeName(f[1]);
  const ascii = sanitizeName(f[2]);
  if (!name) return null;

  return {
    gid,
    name,
    // A duplicate ascii name would double the FTS index without matching anything new.
    ascii: ascii && ascii !== name ? ascii : null,
    latitude,
    longitude,
    countryCode: f[8],
    admin1Code: f[10] || null,
    population: Number(f[14]) || 0,
    timezone: f[17],
  };
};

export type ParsedAlternateName = {
  gid: number;
  lang: CityLang;
  name: string;
  isPreferred: boolean;
};

const isCityLang = (value: string): value is CityLang =>
  (CITY_LANGS as readonly string[]).includes(value);

/**
 * One row of alternateNamesV2. Colloquial and historic names are dropped because they
 * mislead someone picking the city they are currently in.
 */
export const parseAlternateNameLine = (line: string): ParsedAlternateName | null => {
  const f = line.split("\t");
  if (f.length < 5) return null;

  const lang = f[2];
  if (!isCityLang(lang)) return null;
  if (f[6] === "1" || f[7] === "1") return null;

  const name = sanitizeName(f[3] ?? "");
  if (!name) return null;

  const gid = Number(f[1]);
  if (!Number.isFinite(gid)) return null;

  return { gid, lang, name, isPreferred: f[4] === "1" };
};

type NameCandidate = { name: string; isPreferred: boolean };

/** GeoNames lists several names per language; the one flagged preferred wins. */
export const pickPreferredName = (incumbent: NameCandidate, candidate: NameCandidate): string =>
  candidate.isPreferred && !incumbent.isPreferred ? candidate.name : incumbent.name;
