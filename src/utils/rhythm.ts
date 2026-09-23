import { parseISO } from "date-fns";

import { TICK_STATE, type TickState } from "@/constants/Arc";
import { OTHER_TIMING, PRAYER_ID, type PrayerId } from "@/constants/Prayer";
import type { DayPrayerTimes } from "@/types/prayerTimes";

/** The drawing's coordinate space, from the design: a 320 by 110 viewBox. */
export const RHYTHM_BOX = {
  viewWidth: 320,
  viewHeight: 110,
  /** Where Fajr and Isha sit, the line's two ends. */
  start: 11.5,
  end: 305,
  /** Sunrise and Maghrib sit on the horizon; Fajr and Isha a little under it. */
  horizon: 88,
  below: 98,
  /** The highest the day climbs, midway between sunrise and Maghrib. */
  peak: 20,
} as const;

export type RhythmTimingId = PrayerId | typeof OTHER_TIMING.SUNRISE;

/** The timings the line marks, in the day's order. */
export const RHYTHM_TIMINGS: readonly RhythmTimingId[] = [
  PRAYER_ID.FAJR,
  OTHER_TIMING.SUNRISE,
  PRAYER_ID.DHUHR,
  PRAYER_ID.ASR,
  PRAYER_ID.MAGHRIB,
  PRAYER_ID.ISHA,
];

/** Each prayer's stretch: from the timing before it; Fajr's runs to sunrise. */
const SEGMENT_SPAN: Record<PrayerId, readonly [RhythmTimingId, RhythmTimingId]> = {
  [PRAYER_ID.FAJR]: [PRAYER_ID.FAJR, OTHER_TIMING.SUNRISE],
  [PRAYER_ID.DHUHR]: [OTHER_TIMING.SUNRISE, PRAYER_ID.DHUHR],
  [PRAYER_ID.ASR]: [PRAYER_ID.DHUHR, PRAYER_ID.ASR],
  [PRAYER_ID.MAGHRIB]: [PRAYER_ID.ASR, PRAYER_ID.MAGHRIB],
  [PRAYER_ID.ISHA]: [PRAYER_ID.MAGHRIB, PRAYER_ID.ISHA],
};

/** A label's width as a share of the line; closer labels take a second row. */
const LABEL_GAP = 0.12;

/** How far apart the track's sampled points are, in drawing units. */
const SAMPLE_STEP = 4;

type Anchors = { fajr: number; sunrise: number; maghrib: number; isha: number };

export type RhythmGeometry = {
  anchors: Anchors;
  ticks: { id: RhythmTimingId; x: number; y: number; state: TickState }[];
  /** The whole line, Fajr to Isha. */
  track: string;
  segments: Record<PrayerId, string>;
  /** Where the current time sits on the line; null outside Fajr to Isha. */
  now: { x: number; y: number } | null;
  labels: { id: RhythmTimingId; share: number; row: 0 | 1; state: TickState }[];
};

const timeOf = (day: DayPrayerTimes, id: RhythmTimingId) =>
  parseISO(
    id === OTHER_TIMING.SUNRISE ? day.otherTimings[OTHER_TIMING.SUNRISE] : day.timings[id]
  ).getTime();

/** Eases 0 to 1 slowly at both ends, so the line meets the horizon smoothly. */
const ease = (t: number) => t * t * (3 - 2 * t);

/** The line's height at `x`: under the horizon at each end, arched by day. */
export const trackY = (x: number, { anchors }: Pick<RhythmGeometry, "anchors">) => {
  const { horizon, below, peak } = RHYTHM_BOX;
  if (x <= anchors.sunrise) {
    return below - (below - horizon) * ease((x - anchors.fajr) / (anchors.sunrise - anchors.fajr));
  }
  if (x >= anchors.maghrib) {
    return (
      horizon + (below - horizon) * ease((x - anchors.maghrib) / (anchors.isha - anchors.maghrib))
    );
  }
  const share = (x - anchors.sunrise) / (anchors.maghrib - anchors.sunrise);
  return horizon - (horizon - peak) * Math.sin(Math.PI * share);
};

const round = (n: number) => Number(n.toFixed(1));

type Point = { x: number; y: number };

/** Where the line is drawn; the design's own units by default. */
export type RhythmBox = { width: number; height: number; isRTL: boolean };

const DESIGN_BOX: RhythmBox = {
  width: RHYTHM_BOX.viewWidth,
  height: RHYTHM_BOX.viewHeight,
  isRTL: false,
};

/** The line from `from` to `to` in sampled steps, in the box's space. */
const pathBetween = (from: number, to: number, anchors: Anchors, project: (p: Point) => Point) => {
  const xs = [from];
  for (let x = from + SAMPLE_STEP; x < to; x += SAMPLE_STEP) xs.push(x);
  xs.push(to);
  return xs
    .map((x, i) => {
      const p = project({ x, y: trackY(x, { anchors }) });
      return `${i === 0 ? "M" : "L"} ${round(p.x)} ${round(p.y)}`;
    })
    .join(" ");
};

// Drawn in design units, then stretched to the full box width so each tick
// sits over its label, and mirrored right to left. Labels keep reading order.
export const rhythmGeometry = (
  day: DayPrayerTimes,
  now: Date,
  box: RhythmBox = DESIGN_BOX
): RhythmGeometry => {
  const [sx, sy] = [box.width / RHYTHM_BOX.viewWidth, box.height / RHYTHM_BOX.viewHeight];
  const project = ({ x, y }: Point): Point => ({
    x: (box.isRTL ? RHYTHM_BOX.viewWidth - x : x) * sx,
    y: y * sy,
  });
  const times = RHYTHM_TIMINGS.map((id) => timeOf(day, id));
  const [first, last] = [times[0], times[times.length - 1]];
  const xOf = (time: number) =>
    RHYTHM_BOX.start + ((time - first) / (last - first)) * (RHYTHM_BOX.end - RHYTHM_BOX.start);

  const xs = times.map(xOf);
  const anchors: Anchors = {
    fajr: xs[0],
    sunrise: xs[1],
    maghrib: xs[RHYTHM_TIMINGS.indexOf(PRAYER_ID.MAGHRIB)],
    isha: xs[xs.length - 1],
  };

  const clock = now.getTime();
  const currentIndex = times.findLastIndex((time) => time <= clock);
  const stateOf = (i: number): TickState => {
    if (i === currentIndex) return TICK_STATE.CURRENT;
    return i < currentIndex ? TICK_STATE.PASSED : TICK_STATE.FUTURE;
  };

  const ticks = RHYTHM_TIMINGS.map((id, i) => ({
    id,
    ...project({ x: xs[i], y: trackY(xs[i], { anchors }) }),
    state: stateOf(i),
  }));

  const xFor = (id: RhythmTimingId) => xs[RHYTHM_TIMINGS.indexOf(id)];
  const segment = (prayer: PrayerId) => {
    const [from, to] = SEGMENT_SPAN[prayer];
    return pathBetween(xFor(from), xFor(to), anchors, project);
  };
  const segments: Record<PrayerId, string> = {
    [PRAYER_ID.FAJR]: segment(PRAYER_ID.FAJR),
    [PRAYER_ID.DHUHR]: segment(PRAYER_ID.DHUHR),
    [PRAYER_ID.ASR]: segment(PRAYER_ID.ASR),
    [PRAYER_ID.MAGHRIB]: segment(PRAYER_ID.MAGHRIB),
    [PRAYER_ID.ISHA]: segment(PRAYER_ID.ISHA),
  };

  const inside = clock >= first && clock <= last;
  const nowX = xOf(clock);

  let lastRowZero = -Infinity;
  const labels = RHYTHM_TIMINGS.map((id, i) => {
    const share = xs[i] / RHYTHM_BOX.viewWidth;
    const crowded = share - lastRowZero < LABEL_GAP;
    if (!crowded) lastRowZero = share;
    return { id, share, row: crowded ? (1 as const) : (0 as const), state: stateOf(i) };
  });

  return {
    anchors,
    ticks,
    track: pathBetween(anchors.fajr, anchors.isha, anchors, project),
    segments,
    now: inside ? project({ x: nowX, y: trackY(nowX, { anchors }) }) : null,
    labels,
  };
};
