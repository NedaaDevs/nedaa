import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import type { CitySearchResult } from "@/types/cities";
import { NO_PLACE } from "@/constants/CityOffer";
import type { PlaceMark, ZonePlace } from "@/types/cityCheck";
import { trustedCityNear } from "@/utils/cityCheck/cityNear";
import { markPoint, sameMark } from "@/utils/cityCheck/marks";
import { resolveLocalizedName } from "@/utils/cities";

/** The row found for the mark with this point and date. */
type Found = { lat: number; lng: number; at: number; row: CitySearchResult | null };

/** The city and zone of the row near `mark`; undefined while it looks. */
export const useMarkPlace = (mark: PlaceMark | null): ZonePlace | undefined => {
  const { i18n } = useTranslation();
  const [found, setFound] = useState<Found | null>(null);
  const lat = mark?.lat;
  const lng = mark?.lng;
  const at = mark?.at;

  useEffect(() => {
    if (lat === undefined || lng === undefined || at === undefined) return;
    let current = true;
    void trustedCityNear(markPoint({ lat, lng, at })).then((row) => {
      if (current) setFound({ lat, lng, at, row });
    });
    return () => {
      current = false;
    };
  }, [lat, lng, at]);

  if (!mark) return NO_PLACE;
  // An answer for another mark is not this one's.
  if (!found || !sameMark(found, mark)) return undefined;
  const { row } = found;
  if (!row) return NO_PLACE;
  return {
    city: resolveLocalizedName(row.name, row.names ?? undefined, i18n.language),
    zone: row.timezone,
  };
};
