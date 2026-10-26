import { COORDINATE_PROBLEM, type CoordinateProblem } from "@/constants/Cities";
import {
  CITY_LANGS,
  type CityCountry,
  type CityLang,
  type CityRegion,
  type LocalizedNames,
} from "@/types/cities";

// i18next reports the active language as a tag that may carry a region ("ar-SA"),
// while the cities data is keyed by base language.
const baseLanguage = (locale: string): string => locale.split("-")[0].toLowerCase();

const isCityLang = (locale: string): locale is CityLang =>
  (CITY_LANGS as readonly string[]).includes(locale);

/** The localized name for a locale, or the base (English) name when none is stored. */
export const resolveLocalizedName = (
  base: string,
  names: LocalizedNames | undefined,
  locale: string
): string => {
  const lang = baseLanguage(locale);
  if (!isCityLang(lang)) return base;
  return names?.[lang] ?? base;
};

export type CityLabel = {
  city: string;
  /** Region and country — the line that separates same-named cities. */
  secondary: string;
};

/**
 * The parts a label is built from. Kept to exactly what is read so both a search
 * result and a stored manual location satisfy it without sharing a wider type.
 */
export type CityLabelSource = {
  name: string;
  names?: LocalizedNames;
  country: CityCountry;
  region: CityRegion | null;
};

/**
 * Each part resolves independently, so a city with a localized name but an
 * untranslated region still reads correctly rather than falling back wholesale.
 */
export const formatCityLabel = (record: CityLabelSource, locale: string): CityLabel => {
  const city = resolveLocalizedName(record.name, record.names, locale);
  const country = resolveLocalizedName(record.country.name, record.country.names, locale);
  const region = record.region
    ? resolveLocalizedName(record.region.name, record.region.names, locale)
    : null;

  return { city, secondary: region ? `${region}, ${country}` : country };
};

export type BoundingBox = {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
};

/**
 * A window of roughly `degrees` of latitude in every direction. A degree of longitude
 * shrinks with the cosine of latitude, so the longitude span is divided by it to keep
 * the box a similar width in kilometres anywhere on the globe. The cosine is floored
 * because it approaches zero at the poles, where the span is capped instead.
 */
export const boundingBoxFor = (
  latitude: number,
  longitude: number,
  degrees: number
): BoundingBox => {
  const cos = Math.cos((latitude * Math.PI) / 180);
  const lngSpan = Math.min(180, degrees / Math.max(Math.abs(cos), 0.01));

  return {
    minLat: Math.max(-90, latitude - degrees),
    maxLat: Math.min(90, latitude + degrees),
    minLng: longitude - lngSpan,
    maxLng: longitude + lngSpan,
  };
};

const ARABIC_INDIC_ZERO = 0x0660;
const EXTENDED_ARABIC_INDIC_ZERO = 0x06f0;
/** Arabic decimal separator, produced by Arabic and Urdu keyboards. */
const ARABIC_DECIMAL_SEPARATOR = "٫";

/**
 * Rewrites Arabic-Indic and extended Arabic-Indic digits — and the Arabic decimal
 * separator — as their ASCII equivalents, so a coordinate typed on an Arabic or Urdu
 * keyboard parses the same as one typed on a Latin keyboard.
 */
export const toAsciiNumerals = (text: string): string =>
  [...text]
    .map((character) => {
      if (character === ARABIC_DECIMAL_SEPARATOR) return ".";

      const code = character.charCodeAt(0);
      if (code >= ARABIC_INDIC_ZERO && code <= ARABIC_INDIC_ZERO + 9) {
        return String(code - ARABIC_INDIC_ZERO);
      }
      if (code >= EXTENDED_ARABIC_INDIC_ZERO && code <= EXTENDED_ARABIC_INDIC_ZERO + 9) {
        return String(code - EXTENDED_ARABIC_INDIC_ZERO);
      }
      return character;
    })
    .join("");

export const CoordinateAxis = {
  LATITUDE: "latitude",
  LONGITUDE: "longitude",
} as const;

export type CoordinateAxisValue = (typeof CoordinateAxis)[keyof typeof CoordinateAxis];

const AXIS_LIMIT: Record<CoordinateAxisValue, number> = {
  [CoordinateAxis.LATITUDE]: 90,
  [CoordinateAxis.LONGITUDE]: 180,
};

/** A typed coordinate: its decimal degrees, or why it is not one yet. */
export type CoordinateReading = { value: number } | { problem: CoordinateProblem };

const WHOLE_NUMBER = /^[+-]?\d+(\.\d+)?$/;
/** Empty, a sign alone, or digits ending in the decimal mark. */
const PART_TYPED = /^[+-]?(\d+\.)?$/;

/** Reads a coordinate field's text for one axis. */
export const readCoordinate = (text: string, axis: CoordinateAxisValue): CoordinateReading => {
  const normalized = toAsciiNumerals(text).trim();
  if (WHOLE_NUMBER.test(normalized)) {
    const value = Number(normalized);
    return Math.abs(value) <= AXIS_LIMIT[axis]
      ? { value }
      : { problem: COORDINATE_PROBLEM.OUT_OF_RANGE };
  }
  return {
    problem: PART_TYPED.test(normalized)
      ? COORDINATE_PROBLEM.INCOMPLETE
      : COORDINATE_PROBLEM.NOT_A_NUMBER,
  };
};
