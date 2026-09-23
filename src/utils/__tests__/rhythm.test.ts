import { OTHER_TIMING, PRAYER_ID } from "@/constants/Prayer";
import type { DayPrayerTimes } from "@/types/prayerTimes";
import { TICK_STATE } from "@/constants/Arc";
import { RHYTHM_BOX, rhythmGeometry, trackY } from "@/utils/rhythm";

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

const tick = (time: string, id: string) =>
  rhythmGeometry(DAY, at(time)).ticks.find((t) => t.id === id)!;

/** A path's first and last points. */
const ends = (d: string) => {
  const points = [...d.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map(([, x, y]) => [+x, +y]);
  return { first: points[0], last: points.at(-1)! };
};

describe("rhythmGeometry", () => {
  it("runs from Fajr at the start to Isha at the end", () => {
    expect(tick("12:00", PRAYER_ID.FAJR).x).toBeCloseTo(RHYTHM_BOX.start);
    expect(tick("12:00", PRAYER_ID.ISHA).x).toBeCloseTo(RHYTHM_BOX.end);
  });

  // The line is a clock: each prayer sits where its time falls in the day.
  it("places each timing in proportion to its time", () => {
    const share = (minutes("12:00") - minutes("04:30")) / (minutes("19:25") - minutes("04:30"));

    expect(tick("12:00", PRAYER_ID.DHUHR).x).toBeCloseTo(
      RHYTHM_BOX.start + share * (RHYTHM_BOX.end - RHYTHM_BOX.start)
    );
  });

  it("puts sunrise and Maghrib on the horizon, and the day above it", () => {
    expect(tick("12:00", OTHER_TIMING.SUNRISE).y).toBeCloseTo(RHYTHM_BOX.horizon);
    expect(tick("12:00", PRAYER_ID.MAGHRIB).y).toBeCloseTo(RHYTHM_BOX.horizon);
    expect(tick("12:00", PRAYER_ID.DHUHR).y).toBeLessThan(RHYTHM_BOX.horizon);
    expect(tick("12:00", PRAYER_ID.FAJR).y).toBeGreaterThan(RHYTHM_BOX.horizon);
  });

  it("marks what has passed, what is current and what is to come", () => {
    const states = rhythmGeometry(DAY, at("16:00")).ticks.map((t) => [t.id, t.state]);

    expect(states).toEqual([
      [PRAYER_ID.FAJR, TICK_STATE.PASSED],
      [OTHER_TIMING.SUNRISE, TICK_STATE.PASSED],
      [PRAYER_ID.DHUHR, TICK_STATE.PASSED],
      [PRAYER_ID.ASR, TICK_STATE.CURRENT],
      [PRAYER_ID.MAGHRIB, TICK_STATE.FUTURE],
      [PRAYER_ID.ISHA, TICK_STATE.FUTURE],
    ]);
  });

  it("puts the now ring on the track at the current time", () => {
    const { now } = rhythmGeometry(DAY, at("16:00"));

    expect(now!.x).toBeGreaterThan(tick("16:00", PRAYER_ID.ASR).x);
    expect(now!.x).toBeLessThan(tick("16:00", PRAYER_ID.MAGHRIB).x);
    expect(now!.y).toBeCloseTo(trackY(now!.x, rhythmGeometry(DAY, at("16:00"))));
  });

  // The line covers Fajr to Isha; outside it there is no place for the ring.
  it.each(["03:00", "22:00"])("shows no ring at %s", (time) => {
    expect(rhythmGeometry(DAY, at(time)).now).toBeNull();
  });

  it("keeps Isha current after Isha, and nothing current before Fajr", () => {
    expect(tick("22:00", PRAYER_ID.ISHA).state).toBe(TICK_STATE.CURRENT);
    expect(rhythmGeometry(DAY, at("03:00")).ticks.every((t) => t.state === TICK_STATE.FUTURE)).toBe(
      true
    );
  });

  // A prayer's segment is the stretch leading up to it; Fajr's runs to sunrise.
  it.each([
    [PRAYER_ID.FAJR, PRAYER_ID.FAJR, OTHER_TIMING.SUNRISE],
    [PRAYER_ID.DHUHR, OTHER_TIMING.SUNRISE, PRAYER_ID.DHUHR],
    [PRAYER_ID.ISHA, PRAYER_ID.MAGHRIB, PRAYER_ID.ISHA],
  ])("draws the %s segment from %s to %s", (prayer, from, to) => {
    const { first, last } = ends(rhythmGeometry(DAY, at("12:00")).segments[prayer]);

    expect(first[0]).toBeCloseTo(tick("12:00", from).x, 1);
    expect(last[0]).toBeCloseTo(tick("12:00", to).x, 1);
  });

  it("drops a label to the second row when it would crowd the one before", () => {
    const rows = Object.fromEntries(
      rhythmGeometry(DAY, at("12:00")).labels.map((l) => [l.id, l.row])
    );

    expect(rows[PRAYER_ID.FAJR]).toBe(0);
    expect(rows[OTHER_TIMING.SUNRISE]).toBe(1);
    expect(rows[PRAYER_ID.DHUHR]).toBe(0);
  });

  it("keeps every point inside the drawing", () => {
    const { ticks, track } = rhythmGeometry(DAY, at("12:00"));
    const trackYs = [...track.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map(([, , y]) => +y);
    const ys = [...ticks.map((t) => t.y), ...trackYs];

    expect(Math.min(...ys)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...ys)).toBeLessThanOrEqual(RHYTHM_BOX.viewHeight);
  });
});

describe("rhythmGeometry on a real box", () => {
  const BOX = { width: 640, height: 55, isRTL: false };

  // Stretched to the full width, so each tick sits over its label.
  it("stretches the line across the whole width", () => {
    const { ticks } = rhythmGeometry(DAY, at("12:00"), BOX);

    expect(ticks[0].x).toBeCloseTo((RHYTHM_BOX.start / RHYTHM_BOX.viewWidth) * BOX.width);
    expect(ticks.at(-1)!.x).toBeCloseTo((RHYTHM_BOX.end / RHYTHM_BOX.viewWidth) * BOX.width);
    expect(ticks[1].y).toBeCloseTo((RHYTHM_BOX.horizon / RHYTHM_BOX.viewHeight) * BOX.height);
  });

  it("mirrors the line right to left, Fajr at the right edge", () => {
    const ltr = rhythmGeometry(DAY, at("16:00"), BOX);
    const rtl = rhythmGeometry(DAY, at("16:00"), { ...BOX, isRTL: true });

    expect(rtl.ticks[0].x).toBeCloseTo(BOX.width - ltr.ticks[0].x);
    expect(rtl.now!.x).toBeCloseTo(BOX.width - ltr.now!.x);
  });

  // Labels follow reading direction through a logical offset; they never mirror.
  it("keeps label shares in reading order in either direction", () => {
    const ltr = rhythmGeometry(DAY, at("12:00"), BOX).labels;
    const rtl = rhythmGeometry(DAY, at("12:00"), { ...BOX, isRTL: true }).labels;

    expect(rtl).toEqual(ltr);
  });
});
