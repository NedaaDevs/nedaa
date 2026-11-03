import { useTranslation } from "react-i18next";

import { ZONE_LINE, type ZoneLine } from "@/constants/CityOffer";
import { useMinuteClock } from "@/hooks/useMinuteClock";
import type { ZonePlace } from "@/types/cityCheck";
import { zoneCopyOf, zoneDifferenceMinutes, zoneNoteOf } from "@/utils/zoneDifference";

/**
 * How far `place`'s clock runs from `other`'s; null if unknown or equal. The
 * offer names `place` first; the note names `other`, the saved place, first.
 */
export const useZoneLine = (
  place: ZonePlace,
  other: ZonePlace,
  variant: ZoneLine = ZONE_LINE.OFFER
): string | null => {
  const { t } = useTranslation();
  const at = useMinuteClock().getTime();
  if (!place.zone || !other.zone || !place.city || !other.city) return null;
  const minutes = zoneDifferenceMinutes(other.zone, place.zone, at);
  if (minutes === null) return null;
  if (variant === ZONE_LINE.NOTE) {
    const note = zoneNoteOf(minutes);
    return note ? t(note.key, { count: note.count, saved: other.city, place: place.city }) : null;
  }
  const copy = zoneCopyOf(minutes);
  return copy ? t(copy.key, { count: copy.count, place: place.city, other: other.city }) : null;
};
