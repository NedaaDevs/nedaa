import { OTHER_TIMING, PRAYER_ID } from "@/constants/Prayer";
import { TICK_STATE } from "@/constants/Timeline";
import type { DayPrayerTimes } from "@/types/prayerTimes";
import { MORNING_WEIGHT, rhythmLine } from "@/utils/rhythm";

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
const at = (time: string) => new Date(`2026-09-23T${time}:00.000Z`);
const minutes = (time: string) => at(time).getTime() / 60_000;
const line = (time = "16:00") => rhythmLine(DAY, at(time));
const mark = (id: string, time = "16:00") => line(time).marks.find((m) => m.id === id)!;

describe("rhythmLine", () => {
  it("runs from Fajr at the start to Isha at the end", () => {
    expect(mark(PRAYER_ID.FAJR).share).toBe(0);
    expect(mark(PRAYER_ID.ISHA).share).toBe(1);
  });

  // The line is a clock: each prayer sits where its time falls in the day.
  it("places each timing in proportion to its time", () => {
    const afternoon = (minutes("15:20") - minutes("12:00")) / (minutes("19:25") - minutes("15:20"));
    const shares =
      (mark(PRAYER_ID.ASR).share - mark(PRAYER_ID.DHUHR).share) /
      (mark(PRAYER_ID.ISHA).share - mark(PRAYER_ID.ASR).share);

    expect(shares).toBeCloseTo(afternoon);
  });

  // Sunrise to Dhuhr holds no prayer, so it gives its room to the rest.
  it("draws the morning from sunrise to Dhuhr shorter than its time", () => {
    const share = (id: string) => mark(id).share;
    const drawn =
      (share(PRAYER_ID.DHUHR) - share(OTHER_TIMING.SUNRISE)) /
      (share(OTHER_TIMING.SUNRISE) - share(PRAYER_ID.FAJR));
    const timed = (minutes("12:00") - minutes("05:50")) / (minutes("05:50") - minutes("04:30"));

    expect(MORNING_WEIGHT).toBeLessThan(1);
    expect(drawn).toBeCloseTo(timed * MORNING_WEIGHT);
  });

  it("marks what has passed, what is current and what is to come", () => {
    expect(line().marks.map((m) => [m.id, m.state])).toEqual([
      [PRAYER_ID.FAJR, TICK_STATE.PASSED],
      [OTHER_TIMING.SUNRISE, TICK_STATE.PASSED],
      [PRAYER_ID.DHUHR, TICK_STATE.PASSED],
      [PRAYER_ID.ASR, TICK_STATE.CURRENT],
      [PRAYER_ID.MAGHRIB, TICK_STATE.FUTURE],
      [PRAYER_ID.ISHA, TICK_STATE.FUTURE],
    ]);
  });

  it("fills from the current prayer toward the next by the time gone", () => {
    const { progress } = line("16:00");
    const gone = (minutes("16:00") - minutes("15:20")) / (minutes("18:05") - minutes("15:20"));

    expect(progress?.from).toBe(mark(PRAYER_ID.ASR).share);
    expect(progress?.to).toBe(mark(PRAYER_ID.MAGHRIB).share);
    expect(progress?.fraction).toBeCloseTo(gone);
  });

  // After sunrise the next prayer is Dhuhr, so the fill runs there.
  it("fills from sunrise to Dhuhr in the morning", () => {
    const { progress } = line("09:00");

    expect(progress?.from).toBe(mark(OTHER_TIMING.SUNRISE).share);
    expect(progress?.to).toBe(mark(PRAYER_ID.DHUHR).share);
  });

  // Nothing leads anywhere before Fajr or after Isha: the whole line stays matte.
  it.each(["03:00", "22:00"])("fills nothing at %s", (time) => {
    expect(line(time).progress).toBeNull();
  });
});
