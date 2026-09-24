import { parseISO } from "date-fns";

import { OTHER_TIMING, PRAYER_ID } from "@/constants/Prayer";
import { CELESTIAL_BODY, type CelestialBody } from "@/constants/Sky";
import { ONE_DAY_MS, storedDayList, type StoredDays } from "@/utils/phase";

/** Which body is up, and how far across its arc it is, from 0 to 1. */
export type CelestialPosition = { body: CelestialBody; progress: number };

const fraction = (now: Date, from: Date, until: Date) =>
  (now.getTime() - from.getTime()) / (until.getTime() - from.getTime());

// The sun crosses sunrise to Maghrib, the moon Maghrib to the next Fajr; before
// sunrise the sun waits at the start. Undefined outside the stored days.
export const celestialPositionAt = (now: Date, days: StoredDays): CelestialPosition | undefined => {
  const stored = storedDayList(days);

  for (const [i, day] of stored.entries()) {
    const fajr = parseISO(day.timings[PRAYER_ID.FAJR]);
    const sunrise = parseISO(day.otherTimings[OTHER_TIMING.SUNRISE]);
    const maghrib = parseISO(day.timings[PRAYER_ID.MAGHRIB]);
    const next = stored[i + 1];
    const nextFajr = next
      ? parseISO(next.timings[PRAYER_ID.FAJR])
      : new Date(fajr.getTime() + ONE_DAY_MS);

    if (now < fajr) continue;
    if (now < sunrise) return { body: CELESTIAL_BODY.SUN, progress: 0 };
    if (now < maghrib)
      return { body: CELESTIAL_BODY.SUN, progress: fraction(now, sunrise, maghrib) };
    if (now < nextFajr) {
      return { body: CELESTIAL_BODY.MOON, progress: fraction(now, maghrib, nextFajr) };
    }
  }
  return undefined;
};
