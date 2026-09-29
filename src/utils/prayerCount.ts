import { parseISO } from "date-fns";

import { COUNT_AXIS } from "@/constants/Countdown";
import type { PrayerId } from "@/constants/Prayer";
import { PRAYER_CARD_STATE } from "@/constants/PrayerCard";
import { prayersIn, secondsFrom, type CountSettings, type FocusCount } from "@/utils/focusCount";
import { prayerDayAt, storedDayList, type StoredDays } from "@/utils/phase";
import { prayerCards } from "@/utils/prayerCards";

/** One prayer's figure, to or from the time its Today card shows. */
export const prayerCount = (
  id: PrayerId,
  now: Date,
  days: StoredDays,
  settings: CountSettings,
  flipped: boolean
): FocusCount | null => {
  const shown = prayerDayAt(now, days);
  if (!shown) return null;
  const stored = storedDayList(days);
  const { wide, rest } = prayerCards(shown, now, stored[stored.indexOf(shown) + 1]);
  const card = [wide, ...rest].find((each) => each.id === id);
  if (!card) return null;
  const cardTime = parseISO(card.time).getTime();
  const times = prayersIn(days).filter((prayer) => prayer.id === id);
  const named = times.find((prayer) => prayer.time.getTime() === cardTime);
  if (!named) return null;

  // Flipped, the figure counts the prayer's stored time on the other side of now.
  const other =
    named.time > now
      ? times.findLast((prayer) => prayer.time <= now)
      : times.find((prayer) => prayer.time > now);
  // With no other time stored, the figure keeps its side.
  const counted = flipped ? (other ?? named) : named;
  return {
    axis: counted.time > now ? COUNT_AXIS.UNTIL : COUNT_AXIS.SINCE,
    named,
    current: card.state === PRAYER_CARD_STATE.CURRENT,
    counted,
    seconds: secondsFrom(counted, now),
    precise: settings.seconds,
  };
};
