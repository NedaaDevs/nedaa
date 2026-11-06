import { useTranslation } from "react-i18next";

import { useMinuteClock } from "@/hooks/useMinuteClock";
import type { ZonePlace } from "@/types/cityCheck";
import { zoneCopyOf, zoneDifferenceMinutes, zoneNoteOf } from "@/utils/zoneDifference";

type Named = { city: string; zone: string };

const named = (place: ZonePlace): place is Named => place.city !== null && place.zone !== null;

/** The offer's line, `place` against `other`; null if unknown or equal. */
export const useZoneLine = (place: ZonePlace, other: ZonePlace): string | null => {
  const { t } = useTranslation();
  const at = useMinuteClock().getTime();
  if (!named(place) || !named(other)) return null;
  const minutes = zoneDifferenceMinutes(other.zone, place.zone, at);
  const copy = minutes === null ? null : zoneCopyOf(minutes);
  return copy ? t(copy.key, { count: copy.count, place: place.city, other: other.city }) : null;
};

/** Today's note, the saved place against `place`; null if unknown or equal. */
export const useZoneNote = (place: ZonePlace, saved: ZonePlace): string | null => {
  const { t } = useTranslation();
  const at = useMinuteClock().getTime();
  if (!named(place) || !named(saved)) return null;
  const minutes = zoneDifferenceMinutes(saved.zone, place.zone, at);
  const note = minutes === null ? null : zoneNoteOf(minutes);
  return note ? t(note.key, { count: note.count, saved: saved.city, place: place.city }) : null;
};
