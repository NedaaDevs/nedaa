import { useTranslation } from "react-i18next";

import { useMinuteClock } from "@/hooks/useMinuteClock";
import type { ZonePlace } from "@/types/cityCheck";
import { zoneCopyOf, zoneDifferenceMinutes } from "@/utils/zoneDifference";

/** How far `place`'s clock runs from `other`'s; null if unknown or equal. */
export const useZoneLine = (place: ZonePlace, other: ZonePlace): string | null => {
  const { t } = useTranslation();
  const at = useMinuteClock().getTime();
  if (!place.zone || !other.zone || !place.city || !other.city) return null;
  const minutes = zoneDifferenceMinutes(other.zone, place.zone, at);
  const copy = minutes === null ? null : zoneCopyOf(minutes);
  if (!copy) return null;
  return t(copy.key, { count: copy.count, place: place.city, other: other.city });
};
