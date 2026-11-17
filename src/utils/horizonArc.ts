import { MARK_SIZE } from "@/constants/AthkarSession";
import type { PositionMark } from "@/utils/athkarSession";

export type ArcPoint = { x: number; y: number };

/** A drawn curve, measured by distance along it. */
export type ArcCurve = {
  /** The SVG path. */
  d: string;
  length: number;
  /** The point a share of the way along, 0 at the start and 1 at the end. */
  pointAt: (share: number) => ArcPoint;
};

/** The part of the arc the marks sit in; the ends stay clear of the horizon. */
export const ARC_SPAN = { START: 0.05, END: 0.95 } as const;

/** The room a mark takes along the arc, against a full mark's. */
const MARK_ROOM: Record<PositionMark["size"], number> = {
  [MARK_SIZE.FULL]: 1,
  [MARK_SIZE.FINE]: 0.24,
};

const QUAD_STEPS = 240;

const clampShare = (share: number) => Math.min(1, Math.max(0, share));

/** A quadratic curve from one point to another, bent toward the control point. */
export const quadCurve = (from: ArcPoint, control: ArcPoint, to: ArcPoint): ArcCurve => {
  const at = (t: number): ArcPoint => ({
    x: (1 - t) ** 2 * from.x + 2 * (1 - t) * t * control.x + t ** 2 * to.x,
    y: (1 - t) ** 2 * from.y + 2 * (1 - t) * t * control.y + t ** 2 * to.y,
  });
  // Distance travelled at each step of the curve's parameter.
  const travelled = [0];
  let last = from;
  for (let step = 1; step <= QUAD_STEPS; step++) {
    const point = at(step / QUAD_STEPS);
    travelled.push(travelled[step - 1] + Math.hypot(point.x - last.x, point.y - last.y));
    last = point;
  }
  const length = travelled[QUAD_STEPS];

  const pointAt = (share: number): ArcPoint => {
    const clamped = clampShare(share);
    if (clamped === 0) return from;
    if (clamped === 1) return to;
    const goal = clamped * length;
    let low = 0;
    let high = QUAD_STEPS;
    while (high - low > 1) {
      const middle = (low + high) >> 1;
      if (travelled[middle] <= goal) low = middle;
      else high = middle;
    }
    const within = (goal - travelled[low]) / (travelled[high] - travelled[low]);
    return at((low + within) / QUAD_STEPS);
  };

  return {
    d: `M${from.x} ${from.y} Q${control.x} ${control.y} ${to.x} ${to.y}`,
    length,
    pointAt,
  };
};

/** The shorter way round a circle between two points on it. */
export const circleArc = (
  centre: ArcPoint,
  radius: number,
  from: ArcPoint,
  to: ArcPoint
): ArcCurve => {
  const start = Math.atan2(from.y - centre.y, from.x - centre.x);
  const end = Math.atan2(to.y - centre.y, to.x - centre.x);
  let turn = end - start;
  if (turn > Math.PI) turn -= 2 * Math.PI;
  if (turn <= -Math.PI) turn += 2 * Math.PI;
  // y grows downward, so a growing angle turns clockwise.
  const sweep = turn > 0 ? 1 : 0;

  const pointAt = (share: number): ArcPoint => {
    const clamped = clampShare(share);
    if (clamped === 0) return from;
    if (clamped === 1) return to;
    const angle = start + turn * clamped;
    return { x: centre.x + radius * Math.cos(angle), y: centre.y + radius * Math.sin(angle) };
  };

  return {
    d: `M${from.x} ${from.y} A${radius} ${radius} 0 0 ${sweep} ${to.x} ${to.y}`,
    length: Math.abs(turn) * radius,
    pointAt,
  };
};

/** Where each mark sits along the arc, as a share of its length. */
export const markShares = (marks: readonly PositionMark[]): number[] => {
  const total = marks.reduce((sum, mark) => sum + MARK_ROOM[mark.size], 0);
  const width = ARC_SPAN.END - ARC_SPAN.START;
  let before = 0;
  return marks.map((mark) => {
    const room = MARK_ROOM[mark.size];
    const share = ARC_SPAN.START + width * ((before + room / 2) / total);
    before += room;
    return share;
  });
};

/**
 * How far the lit line reaches: from the mark before the place to the place's
 * own mark as its count fills. A session with no place is lit to its last mark.
 */
export const litShare = (
  shares: readonly number[],
  index: number | null,
  fraction: number
): number => {
  if (index === null) return shares.at(-1) ?? 0;
  const from = index > 0 ? shares[index - 1] : 0;
  return from + (shares[index] - from) * clampShare(fraction);
};
