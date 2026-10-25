import { useTranslation } from "react-i18next";

import { knownPlaceName } from "@/constants/Location";
import { LocationMode } from "@/enums/location";
import { useLocationStore } from "@/stores/location";
import type { ManualLocation } from "@/types/location";
import { resolveLocalizedName } from "@/utils/cities";

export type Place = {
  city: string | undefined;
  country: string | undefined;
  /** City and country together, or whichever of the two is known. */
  name: string | undefined;
};

type Parts = { city?: string | null; country?: string | null };

const hasPart = ({ city, country }: Parts) =>
  Boolean(knownPlaceName(city) || knownPlaceName(country));

/** A chosen city's own names in the app's language. */
const chosenCityParts = (city: ManualLocation, language: string): Parts => ({
  city: resolveLocalizedName(city.name, city.names, language),
  country: resolveLocalizedName(city.country.name, city.country.names, language),
});

/** The place in the app's language; a device's falls back to its address. */
export const usePlace = (): Place => {
  const { t, i18n } = useTranslation();
  const chosen = useLocationStore((state) =>
    state.locationMode === LocationMode.MANUAL ? state.manualLocation : null
  );
  const localized = useLocationStore((state) => state.localizedLocation);
  const address = useLocationStore((state) => state.locationDetails.address);
  const parts: Parts = chosen
    ? chosenCityParts(chosen, i18n.language)
    : hasPart(localized)
      ? localized
      : (address ?? {});
  const city = knownPlaceName(parts.city);
  const country = knownPlaceName(parts.country);
  const name = city && country ? t("place.name", { city, country }) : city || country;
  return { city, country, name };
};
