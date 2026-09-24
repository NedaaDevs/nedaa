import { parseISO } from "date-fns";

import { PRAYER_CARD_STATE, type PrayerCardState } from "@/constants/PrayerCard";
import { PRAYER_ID, PRAYER_IDS, type PrayerId } from "@/constants/Prayer";
import type { DayPrayerTimes } from "@/types/prayerTimes";

export type PrayerCard = { id: PrayerId; time: string; state: PrayerCardState };

/** The day's five cards: one wide, the other four in order, two by two. */
export const prayerCards = (
  day: DayPrayerTimes,
  now: Date,
  /** The day after, whose Fajr is next once today's Isha is in. */
  following?: DayPrayerTimes | null
): { wide: PrayerCard; rest: PrayerCard[] } => {
  const clock = now.getTime();
  const passed = (id: PrayerId) => parseISO(day.timings[id]).getTime() <= clock;
  const next = PRAYER_IDS.find((id) => !passed(id));

  const cardOf = (id: PrayerId): PrayerCard => ({
    id,
    time: day.timings[id],
    state:
      id === next
        ? PRAYER_CARD_STATE.NEXT
        : passed(id)
          ? PRAYER_CARD_STATE.PAST
          : PRAYER_CARD_STATE.FUTURE,
  });

  // After Isha, tomorrow's Fajr leads, at tomorrow's time.
  if (!next && following) {
    return {
      wide: {
        id: PRAYER_ID.FAJR,
        time: following.timings[PRAYER_ID.FAJR],
        state: PRAYER_CARD_STATE.NEXT,
      },
      rest: PRAYER_IDS.filter((id) => id !== PRAYER_ID.FAJR).map(cardOf),
    };
  }
  // With no tomorrow stored, nothing is next; Isha keeps the wide row.
  const leading = next ?? PRAYER_ID.ISHA;
  return {
    wide: cardOf(leading),
    rest: PRAYER_IDS.filter((id) => id !== leading).map(cardOf),
  };
};
