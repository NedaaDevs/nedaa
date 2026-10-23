import { OTHER_TIMING, PRAYER_ID } from "@/constants/Prayer";
import { TICK_STATE } from "@/constants/Timeline";
import type { DayPrayerTimes } from "@/types/prayerTimes";
import { rhythmLine } from "@/utils/rhythm";

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
    [OTHER_TIMING.MIDNIGHT]: "2026-09-23T23:57:00.000Z",
    [OTHER_TIMING.LAST_THIRD]: "2026-09-24T01:55:00.000Z",
  } as DayPrayerTimes["otherTimings"],
};

/** The day after, its Fajr at 04:31. */
const NEXT: DayPrayerTimes = {
  ...DAY,
  date: 20260924,
  timings: {
    [PRAYER_ID.FAJR]: "2026-09-24T04:31:00.000Z",
    [PRAYER_ID.DHUHR]: "2026-09-24T12:00:00.000Z",
    [PRAYER_ID.ASR]: "2026-09-24T15:19:00.000Z",
    [PRAYER_ID.MAGHRIB]: "2026-09-24T18:03:00.000Z",
    [PRAYER_ID.ISHA]: "2026-09-24T19:23:00.000Z",
  },
  otherTimings: {
    [OTHER_TIMING.SUNRISE]: "2026-09-24T05:51:00.000Z",
    [OTHER_TIMING.MIDNIGHT]: "2026-09-24T23:57:00.000Z",
    [OTHER_TIMING.LAST_THIRD]: "2026-09-25T01:55:00.000Z",
  } as DayPrayerTimes["otherTimings"],
};

const at = (iso: string) => new Date(iso.length <= 5 ? `2026-09-23T${iso}:00.000Z` : iso);
const minutes = (time: string) => at(time).getTime() / 60_000;
const line = (time = "16:00") => rhythmLine(DAY, at(time));
const mark = (id: string, time = "16:00") => line(time).marks.find((m) => m.id === id)!;
const nightAt = (iso: string, following: DayPrayerTimes | null = NEXT) =>
  rhythmLine(DAY, at(iso), following);

/** Isha to the next Fajr, in minutes. */
const NIGHT = (Date.parse(NEXT.timings.fajr) - Date.parse(DAY.timings.isha)) / 60_000;
const fromIsha = (iso: string) => (at(iso).getTime() - Date.parse(DAY.timings.isha)) / 60_000;

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

  // The morning keeps its full time, so the sun crests near Dhuhr.
  it("draws the morning from sunrise to Dhuhr at its full time", () => {
    const share = (id: string) => mark(id).share;
    const drawn =
      (share(PRAYER_ID.DHUHR) - share(OTHER_TIMING.SUNRISE)) /
      (share(OTHER_TIMING.SUNRISE) - share(PRAYER_ID.FAJR));
    const timed = (minutes("12:00") - minutes("05:50")) / (minutes("05:50") - minutes("04:30"));

    expect(drawn).toBeCloseTo(timed);
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

  it("places now between the current prayer and the next by the time gone", () => {
    const { now } = line("16:00");

    expect(now).toBeCloseTo(
      (minutes("16:00") - minutes("04:30")) / (minutes("19:25") - minutes("04:30"))
    );
    expect(now).toBeGreaterThan(mark(PRAYER_ID.ASR).share);
    expect(now).toBeLessThan(mark(PRAYER_ID.MAGHRIB).share);
  });

  it("places now between sunrise and Dhuhr in the morning", () => {
    const { now } = line("09:00");

    expect(now).toBeGreaterThan(mark(OTHER_TIMING.SUNRISE).share);
    expect(now).toBeLessThan(mark(PRAYER_ID.DHUHR).share);
  });

  // Before Fajr nothing of the day has gone: now waits at the Fajr foot.
  it("holds now at the Fajr foot before Fajr", () => {
    expect(line("03:00").now).toBe(0);
    expect(line("03:00").night).toBeNull();
  });

  it("names no night while the day runs", () => {
    expect(line("19:24").night).toBeNull();
  });

  // Gold marks the prayer in focus: just come in, else the next; never sunrise.
  it.each([
    ["03:00", PRAYER_ID.FAJR],
    ["05:00", PRAYER_ID.DHUHR],
    ["09:00", PRAYER_ID.DHUHR],
    ["16:00", PRAYER_ID.MAGHRIB],
    ["15:32", PRAYER_ID.ASR],
    ["15:50", PRAYER_ID.MAGHRIB],
  ])("puts the focus at %s on %s", (time, focus) => {
    expect(line(time).focus).toBe(focus);
  });

  it("names no next prayer after Isha", () => {
    expect(line("22:00").focus).toBeNull();
  });

  it("names tomorrow's Fajr next after Isha, when tomorrow is stored", () => {
    expect(rhythmLine(DAY, at("22:00"), DAY).focus).toBe(PRAYER_ID.FAJR);
  });
});

describe("rhythmLine by night", () => {
  // The moon leaves the Isha foot and walks back toward the Fajr foot.
  it("walks now back from Isha toward the next Fajr by the night gone", () => {
    expect(nightAt("2026-09-23T22:00:00.000Z").now).toBeCloseTo(
      1 - fromIsha("2026-09-23T22:00:00.000Z") / NIGHT
    );
    expect(nightAt("2026-09-24T03:40:00.000Z").now).toBeLessThan(0.1);
  });

  it.each([
    ["Isha", "2026-09-23T19:25:00.000Z"],
    ["the next Fajr", "2026-09-24T04:31:00.000Z"],
  ])("does not jump at %s", (_name, iso) => {
    const instant = at(iso).getTime();
    const before = new Date(instant - 1000);
    const after = new Date(instant + 1000);
    const lineBefore = rhythmLine(DAY, before, NEXT);
    // After the next Fajr, the next prayer day is shown.
    const lineAfter =
      instant === Date.parse(NEXT.timings.fajr)
        ? rhythmLine(NEXT, after, null)
        : rhythmLine(DAY, after, NEXT);

    expect(Math.abs(lineAfter.now - lineBefore.now)).toBeLessThan(0.001);
  });

  it("is night from Isha on", () => {
    expect(nightAt("2026-09-23T19:25:00.000Z").night).not.toBeNull();
  });

  // Midnight and the last third are the night's own marks.
  it("marks midnight and the last third where they fall on the walk back", () => {
    const { night } = nightAt("2026-09-24T00:30:00.000Z");

    expect(night?.map(({ id, state }) => [id, state])).toEqual([
      [OTHER_TIMING.MIDNIGHT, TICK_STATE.CURRENT],
      [OTHER_TIMING.LAST_THIRD, TICK_STATE.FUTURE],
    ]);
    expect(night?.[0].share).toBeCloseTo(1 - fromIsha("2026-09-23T23:57:00.000Z") / NIGHT);
    expect(night?.[1].share).toBeCloseTo(1 - fromIsha("2026-09-24T01:55:00.000Z") / NIGHT);
  });

  // A provider may date the night's times by either day.
  it("takes a night time from the day after when the day's own falls outside", () => {
    const early = {
      ...DAY,
      otherTimings: {
        ...DAY.otherTimings,
        [OTHER_TIMING.MIDNIGHT]: "2026-09-22T23:57:00.000Z",
        [OTHER_TIMING.LAST_THIRD]: "",
      },
    } as DayPrayerTimes;
    const following = {
      ...NEXT,
      otherTimings: { ...NEXT.otherTimings, [OTHER_TIMING.MIDNIGHT]: "2026-09-23T23:59:00.000Z" },
    } as DayPrayerTimes;

    const { night } = rhythmLine(early, at("2026-09-23T22:00:00.000Z"), following);

    expect(night?.map(({ id }) => id)).toEqual([OTHER_TIMING.MIDNIGHT]);
    expect(night?.[0].share).toBeCloseTo(1 - fromIsha("2026-09-23T23:59:00.000Z") / NIGHT);
  });

  // With no day after stored, the night still ends a day after this Fajr.
  it("ends the night a day after Fajr when the next day is not stored", () => {
    const { now } = nightAt("2026-09-24T04:29:00.000Z", null);

    expect(now).toBeCloseTo(1 / (NIGHT - 1), 2);
  });
});
