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
const { PAST, CURRENT, NEXT, FUTURE } = PRAYER_CARD_STATE;
const shape = (time: string) => {
  const { lead, cards } = at(time);
  return [[lead.id, lead.state], cards.map((card) => [card.id, card.state])];
};

describe("prayerCards", () => {
  // Five equal cards in the day's order; the next prayer leads by its state.
  it("keeps the day's order and names the next prayer as the lead", () => {
    expect(shape("14:02")).toEqual([
      [PRAYER_ID.ASR, NEXT],
      [
        [PRAYER_ID.FAJR, PAST],
        [PRAYER_ID.DHUHR, PAST],
        [PRAYER_ID.ASR, NEXT],
        [PRAYER_ID.MAGHRIB, FUTURE],
        [PRAYER_ID.ISHA, FUTURE],
      ],
    ]);
  });

  it("hands back the lead as one of the five cards", () => {
    const { lead, cards } = at("14:02");

    expect(cards).toContain(lead);
  });

  // A prayer just come in keeps the lead, as the current one, for its window.
  it("keeps a prayer just come in as the lead, as the current one", () => {
    expect(shape("15:32")).toEqual([
      [PRAYER_ID.ASR, CURRENT],
      [
        [PRAYER_ID.FAJR, PAST],
        [PRAYER_ID.DHUHR, PAST],
        [PRAYER_ID.ASR, CURRENT],
        [PRAYER_ID.MAGHRIB, FUTURE],
        [PRAYER_ID.ISHA, FUTURE],
      ],
    ]);
  });

  it("hands the lead to the next prayer once that window ends", () => {
    expect(shape("15:50")[0]).toEqual([PRAYER_ID.MAGHRIB, NEXT]);
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
    const { lead, cards } = prayerCards(DAY, new Date("2026-09-23T22:00:00.000Z"), tomorrow);

    expect(lead).toEqual({
      id: PRAYER_ID.FAJR,
      time: tomorrow.timings[PRAYER_ID.FAJR],
      state: NEXT,
    });
    expect(cards.map((card) => [card.id, card.state])).toEqual([
      [PRAYER_ID.FAJR, NEXT],
      [PRAYER_ID.DHUHR, PAST],
      [PRAYER_ID.ASR, PAST],
      [PRAYER_ID.MAGHRIB, PAST],
      [PRAYER_ID.ISHA, PAST],
    ]);
  });

  // Without tomorrow's times nothing can be next; Isha keeps the lead, quiet.
  it("leads with Isha, passed, when tomorrow is not stored", () => {
    expect(shape("22:00")).toEqual([
      [PRAYER_ID.ISHA, PAST],
      [
        [PRAYER_ID.FAJR, PAST],
        [PRAYER_ID.DHUHR, PAST],
        [PRAYER_ID.ASR, PAST],
        [PRAYER_ID.MAGHRIB, PAST],
        [PRAYER_ID.ISHA, PAST],
      ],
    ]);
  });

  it("carries each prayer's time", () => {
    expect(at("14:02").lead.time).toBe(DAY.timings[PRAYER_ID.ASR]);
  });
});
