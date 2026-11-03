import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import type { CitySearchResult } from "@/types/cities";
import type { PlaceMark } from "@/types/cityCheck";
import { trustedCityNear } from "@/utils/cityCheck/cityNear";
import { markPoint } from "@/utils/cityCheck/marks";
import { resolveLocalizedName } from "@/utils/cities";

/** A remembered point as the city list names it; nulls when no row does. */
export type MarkPlace = { city: string | null; zone: string | null };

/** The row found for the mark with this point and date. */
type Found = { lat: number; lng: number; at: number; row: CitySearchResult | null };

/** The city and zone of the row near `mark`; undefined while it looks. */
export const useMarkPlace = (mark: PlaceMark | null): MarkPlace | undefined => {
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

  if (!mark) return { city: null, zone: null };
  // An answer for another mark is not this one's.
  if (!found || found.lat !== lat || found.lng !== lng || found.at !== at) return undefined;
  const { row } = found;
  if (!row) return { city: null, zone: null };
  return {
    city: resolveLocalizedName(row.name, row.names ?? undefined, i18n.language),
    zone: row.timezone,
  };
};
