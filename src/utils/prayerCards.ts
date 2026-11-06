import { parseISO } from "date-fns";

import { PRAYER_CARD_STATE, type PrayerCardState } from "@/constants/PrayerCard";
import { PRAYER_ID, PRAYER_IDS, type PrayerId } from "@/constants/Prayer";
import type { DayPrayerTimes } from "@/types/prayerTimes";
import { inFocusWindow } from "@/utils/focusCount";

export type PrayerCard = { id: PrayerId; time: string; state: PrayerCardState };

export type PrayerCards = {
  lead: PrayerCard;
  cards: PrayerCard[];
  /** The share of the way from the last prayer to the next; null without both. */
  progress: number | null;
};

/** The day's five cards in order, and the lead: just come in, else next. */
export const prayerCards = (
  day: DayPrayerTimes,
  now: Date,
  /** The day after, whose Fajr is next once today's Isha is in. */
  following?: DayPrayerTimes | null
): PrayerCards => {
  const clock = now.getTime();
  const timeOf = (id: PrayerId) => parseISO(day.timings[id]).getTime();
  const passed = (id: PrayerId) => timeOf(id) <= clock;
  const next = PRAYER_IDS.find((id) => !passed(id));
  const latest = PRAYER_IDS.findLast(passed);
  // A prayer just come in keeps the lead for its window, as the current one.
  const current = latest && inFocusWindow(timeOf(latest), clock) ? latest : undefined;
  // After Isha's window, tomorrow's Fajr leads, at tomorrow's time.
  const tomorrowFajr = !current && !next && following;

  const cardOf = (id: PrayerId): PrayerCard => {
    if (id === current) return { id, time: day.timings[id], state: PRAYER_CARD_STATE.CURRENT };
    if (id === next && !current) {
      return { id, time: day.timings[id], state: PRAYER_CARD_STATE.NEXT };
    }
    if (tomorrowFajr && id === PRAYER_ID.FAJR) {
      return { id, time: following.timings[id], state: PRAYER_CARD_STATE.NEXT };
    }
    const state = passed(id) ? PRAYER_CARD_STATE.PAST : PRAYER_CARD_STATE.FUTURE;
    return { id, time: day.timings[id], state };
  };

  const cards = PRAYER_IDS.map(cardOf);
  // With no tomorrow stored, nothing is next; Isha keeps the lead.
  const leading = current ?? next ?? (tomorrowFajr ? PRAYER_ID.FAJR : PRAYER_ID.ISHA);

  const nextTime = next
    ? timeOf(next)
    : following
      ? parseISO(following.timings[PRAYER_ID.FAJR]).getTime()
      : undefined;
  const progress =
    latest && nextTime !== undefined
      ? (clock - timeOf(latest)) / (nextTime - timeOf(latest))
      : null;
  return { lead: cards[PRAYER_IDS.indexOf(leading)], cards, progress };
};
