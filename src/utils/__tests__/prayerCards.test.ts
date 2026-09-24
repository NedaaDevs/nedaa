import { PRAYER_CARD_STATE } from "@/constants/PrayerCard";
import { OTHER_TIMING, PRAYER_ID } from "@/constants/Prayer";
import type { DayPrayerTimes } from "@/types/prayerTimes";
import { prayerCards } from "@/utils/prayerCards";

const DAY: DayPrayerTimes = {
  date: 20260923,
  timezone: "UTC",
  timings: {
    [PRAYER_ID.FAJR]: "2026-09-23T04:30:00.000Z",
    [PRAYER_ID.DHUHR]: "2026-09-23T12:00:00.000Z",
    [PRAYER_ID.ASR]: "2026-09-23T15:20:00.000Z",
    [PRAYER_ID.MAGHRIB]: "2026-09-23T18:05:00.000Z",
    [PRAYER_ID.ISHA]: "2026-09-23T19:25:00.000Z",
  },
  otherTimings: {
    [OTHER_TIMING.SUNRISE]: "2026-09-23T05:50:00.000Z",
  } as DayPrayerTimes["otherTimings"],
};
const at = (time: string) => prayerCards(DAY, new Date(`2026-09-23T${time}:00.000Z`));
const { PAST, NEXT, FUTURE } = PRAYER_CARD_STATE;
const shape = (time: string) => {
  const { wide, rest } = at(time);
  return [[wide.id, wide.state], rest.map((card) => [card.id, card.state])];
};

describe("prayerCards", () => {
  // The next prayer leads, full width; the rest keep the day's order two by two.
  it("puts the next prayer first and the others after it in order", () => {
    expect(shape("14:02")).toEqual([
      [PRAYER_ID.ASR, NEXT],
      [
        [PRAYER_ID.FAJR, PAST],
        [PRAYER_ID.DHUHR, PAST],
        [PRAYER_ID.MAGHRIB, FUTURE],
        [PRAYER_ID.ISHA, FUTURE],
      ],
    ]);
  });

  it("leads with Fajr before dawn", () => {
    expect(shape("03:00")[0]).toEqual([PRAYER_ID.FAJR, NEXT]);
  });

  // After Isha the next prayer is tomorrow's Fajr, at tomorrow's time.
  it("leads with tomorrow's Fajr once the day's prayers are all in", () => {
    const tomorrow = {
      ...DAY,
      date: 20260924,
      timings: { ...DAY.timings, [PRAYER_ID.FAJR]: "2026-09-24T04:31:00.000Z" },
    };
    const { wide, rest } = prayerCards(DAY, new Date("2026-09-23T22:00:00.000Z"), tomorrow);

    expect(wide).toEqual({
      id: PRAYER_ID.FAJR,
      time: tomorrow.timings[PRAYER_ID.FAJR],
      state: NEXT,
    });
    expect(rest.map((card) => [card.id, card.state])).toEqual([
      [PRAYER_ID.DHUHR, PAST],
      [PRAYER_ID.ASR, PAST],
      [PRAYER_ID.MAGHRIB, PAST],
      [PRAYER_ID.ISHA, PAST],
    ]);
  });

  // Without tomorrow's times nothing can be next; Isha keeps the wide row, quiet.
  it("leads with Isha, passed, when tomorrow is not stored", () => {
    expect(shape("22:00")).toEqual([
      [PRAYER_ID.ISHA, PAST],
      [
        [PRAYER_ID.FAJR, PAST],
        [PRAYER_ID.DHUHR, PAST],
        [PRAYER_ID.ASR, PAST],
        [PRAYER_ID.MAGHRIB, PAST],
      ],
    ]);
  });

  it("carries each prayer's time", () => {
    expect(at("14:02").wide.time).toBe(DAY.timings[PRAYER_ID.ASR]);
  });
});
