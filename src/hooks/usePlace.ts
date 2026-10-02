import { useTranslation } from "react-i18next";

import { PLACE_UNKNOWN } from "@/constants/Location";
import { useLocationStore } from "@/stores/location";

export type Place = {
  city: string | undefined;
  country: string | undefined;
  /** City and country together, or whichever of the two is known. */
  name: string | undefined;
};

type Parts = { city?: string | null; country?: string | null };

const known = (part: string | null | undefined) =>
  part && part !== PLACE_UNKNOWN ? part : undefined;

const hasPart = ({ city, country }: Parts) => Boolean(known(city) || known(country));

/**
 * The user's place in the app's language. Falls back, as a whole, to the
 * device's address, which the store fills before the localized name lands.
 */
export const usePlace = (): Place => {
  const { t } = useTranslation();
  const localized = useLocationStore((state) => state.localizedLocation);
  const address = useLocationStore((state) => state.locationDetails.address);
  const parts: Parts = hasPart(localized) ? localized : (address ?? {});
  const city = known(parts.city);
  const country = known(parts.country);
  const name = city && country ? t("place.name", { city, country }) : city || country;
  return { city, country, name };
};
