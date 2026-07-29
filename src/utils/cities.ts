import { CITY_LANGS, type CityLang, type CityRecord, type LocalizedNames } from "@/types/cities";

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
 * Each part resolves independently, so a city with a localized name but an
 * untranslated region still reads correctly rather than falling back wholesale.
 */
export const formatCityLabel = (
  record: CityRecord & { names?: LocalizedNames },
  locale: string
): CityLabel => {
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
