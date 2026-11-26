import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";

import { knownPlaceName } from "@/constants/Location";
import { LocationMode } from "@/enums/location";
import { useLocationStore } from "@/stores/location";
import type { ManualLocation, PlaceRecord } from "@/types/location";
import { resolveLocalizedName } from "@/utils/cities";

export type Place = {
  city: string | undefined;
  country: string | undefined;
  /** City and country together, or whichever of the two is known. */
  name: string | undefined;
};

/** What a place is named from, saved or kept as the previous place. */
type PlaceSource = Pick<
  PlaceRecord,
  "locationMode" | "manualLocation" | "localizedLocation" | "address"
>;

type Parts = { city?: string | null; country?: string | null };

const hasPart = ({ city, country }: Parts) =>
  Boolean(knownPlaceName(city) || knownPlaceName(country));

/** A chosen city's own names in the app's language. */
const chosenCityParts = (city: ManualLocation, language: string): Parts => ({
  city: resolveLocalizedName(city.name, city.names, language),
  country: resolveLocalizedName(city.country.name, city.country.names, language),
});

/** The place in the app's language; a device's falls back to its address. */
const placeOf = (source: PlaceSource, t: TFunction, language: string): Place => {
  const chosen = source.locationMode === LocationMode.MANUAL ? source.manualLocation : null;
  const parts: Parts = chosen
    ? chosenCityParts(chosen, language)
    : hasPart(source.localizedLocation)
      ? source.localizedLocation
      : (source.address ?? {});
  const city = knownPlaceName(parts.city);
  const country = knownPlaceName(parts.country);
  const name = city && country ? t("place.name", { city, country }) : city || country;
  return { city, country, name };
};

/** The place the last write set, whether or not its times landed. */
export const useNewestPlace = (): Place => {
  const { t, i18n } = useTranslation();
  const locationMode = useLocationStore((state) => state.locationMode);
  const manualLocation = useLocationStore((state) => state.manualLocation);
  const localizedLocation = useLocationStore((state) => state.localizedLocation);
  const address = useLocationStore((state) => state.locationDetails.address);
  return placeOf({ locationMode, manualLocation, localizedLocation, address }, t, i18n.language);
};

/** The place the stored times belong to, in the app's language. */
export const usePlace = (): Place => {
  const { t, i18n } = useTranslation();
  // Set from a new point's write until its times are read back.
  const previous = useLocationStore((state) => state.previousPlace);
  const newest = useNewestPlace();
  return previous ? placeOf(previous, t, i18n.language) : newest;
};
