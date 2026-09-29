import { parseISO } from "date-fns";

import { OTHER_TIMING, PRAYER_ID, type PrayerId } from "@/constants/Prayer";
import { PRAYER_CARD_STATE } from "@/constants/PrayerCard";
import type { DayPrayerTimes } from "@/types/prayerTimes";
import { focusCount, type CountSettings } from "@/utils/focusCount";
import { prayerDayAt, storedDayList, type StoredDays } from "@/utils/phase";
import { prayerCards } from "@/utils/prayerCards";
import { prayerCount } from "@/utils/prayerCount";
import { rhythmLine } from "@/utils/rhythm";

/** A summer day far north: Isha close to midnight, or past it. */
const day = (date: string, next: string, isha: string): DayPrayerTimes => ({
  date: Number(date.replaceAll("-", "")),
  timezone: "UTC",
  timings: {
    [PRAYER_ID.FAJR]: `${date}T02:40:00.000Z`,
    [PRAYER_ID.DHUHR]: `${date}T13:05:00.000Z`,
    [PRAYER_ID.ASR]: `${date}T17:25:00.000Z`,
    [PRAYER_ID.MAGHRIB]: `${date}T21:20:00.000Z`,
    [PRAYER_ID.ISHA]: isha.startsWith("+")
      ? `${next}T${isha.slice(1)}:00.000Z`
      : `${date}T${isha}:00.000Z`,
  },
  otherTimings: {
    [OTHER_TIMING.SUNRISE]: `${date}T04:45:00.000Z`,
  } as DayPrayerTimes["otherTimings"],
});

const daysWithIsha = (isha: string): StoredDays => ({
  yesterday: day("2026-06-20", "2026-06-21", isha),
  today: day("2026-06-21", "2026-06-22", isha),
  tomorrow: day("2026-06-22", "2026-06-23", isha),
});

const OFF: CountSettings = { seconds: false };
const momentOf = (iso: string) => new Date(`${iso}:00.000Z`);

/** The prayer day Today shows at `now`, and the stored day after it. */
const shownAt = (now: Date, days: StoredDays) => {
  const shown = prayerDayAt(now, days)!;
  const stored = storedDayList(days);
  return { shown, following: stored[stored.indexOf(shown) + 1] ?? null };
};

/** What each view puts first at `now`: countdown, wide card, timeline. */
const leadsAt = (iso: string, days: StoredDays) => {
  const now = momentOf(iso);
  const { shown, following } = shownAt(now, days);
  const count = focusCount(now, days, OFF, false)!;
  const { wide } = prayerCards(shown, now, following);
  const line = rhythmLine(shown, now, following);
  return {
    countdown: [count.named.id, count.current] as [PrayerId, boolean],
    card: [wide.id, wide.state === PRAYER_CARD_STATE.CURRENT] as [PrayerId, boolean],
    timeline: line.focus,
  };
};

/** Moments around a late Isha: a name, Isha's time on its day, and the moment. */
const MOMENTS: [string, string, string][] = [
  ["an evening before Isha", "23:50", "2026-06-21T23:00"],
  ["Isha's window crossing midnight", "23:50", "2026-06-22T00:10"],
  ["just after Isha's window", "23:50", "2026-06-22T00:30"],
  ["the small hours", "23:50", "2026-06-22T02:00"],
  ["Isha still to come after midnight", "+00:20", "2026-06-22T00:10"],
  ["Isha come in after midnight", "+00:20", "2026-06-22T00:30"],
  ["Fajr's window", "23:50", "2026-06-22T02:50"],
];

describe("the countdown, the cards and the timeline agree on the prayer in focus", () => {
  it.each(MOMENTS)("in %s", (_name, isha, now) => {
    const { countdown, card, timeline } = leadsAt(now, daysWithIsha(isha));

    expect(card).toEqual(countdown);
    expect(timeline).toBe(countdown[0]);
  });
});

describe("a prayer's own figure agrees with Today", () => {
  it.each(MOMENTS)("on the prayer in focus in %s", (_name, isha, iso) => {
    const [now, days] = [momentOf(iso), daysWithIsha(isha)];
    const today = focusCount(now, days, OFF, false)!;

    expect(prayerCount(today.named.id, now, days, OFF, false)).toEqual(today);
  });

  it.each(MOMENTS)("on the time each card shows in %s", (_name, isha, iso) => {
    const [now, days] = [momentOf(iso), daysWithIsha(isha)];
    const { shown, following } = shownAt(now, days);
    const { wide, rest } = prayerCards(shown, now, following);

    for (const card of [wide, ...rest]) {
      const own = prayerCount(card.id, now, days, OFF, false);
      expect(own?.named.time).toEqual(parseISO(card.time));
    }
  });
});
