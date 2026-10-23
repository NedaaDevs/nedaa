import { BOWL } from "@/constants/Timeline";

/** A point on the rim, with the rim's outward normal there. */
export type BowlPoint = { x: number; y: number; nx: number; ny: number };

/** The circle through both feet and the crest of a bowl `width` by `height`. */
const circleOf = (width: number, height: number) => {
  const half = width / 2 - BOWL.inset;
  const horizon = height - BOWL.footRoom;
  const rise = horizon - BOWL.crest;
  const radius = (half * half + rise * rise) / (2 * rise);
  const centre = { x: width / 2, y: BOWL.crest + radius };
  // The feet's angle above the centre; negative in a bowl taller than wide.
  const foot = Math.atan2(centre.y - horizon, half);
  return { radius, centre, foot, span: Math.PI - 2 * foot };
};

const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1);

/** Where a share of the arc falls, from the start edge's foot at 0. */
export const bowlPoint = (
  share: number,
  width: number,
  height: number,
  isRTL: boolean
): BowlPoint => {
  const { radius, centre, foot, span } = circleOf(width, height);
  const angle = Math.PI - foot - span * clamp01(share);
  // RTL starts at the end edge.
  const dx = radius * Math.cos(angle) * (isRTL ? -1 : 1);
  const dy = -radius * Math.sin(angle);
  return { x: centre.x + dx, y: centre.y + dy, nx: dx / radius, ny: dy / radius };
};

const fixed = ({ x, y }: BowlPoint) => `${x.toFixed(2)} ${y.toFixed(2)}`;

/** The rim from one share to another, as one circular arc. */
export const bowlPath = (
  from: number,
  to: number,
  width: number,
  height: number,
  isRTL: boolean
): string => {
  const { radius, span } = circleOf(width, height);
  const large = span * Math.abs(to - from) > Math.PI ? 1 : 0;
  const sweep = isRTL ? 0 : 1;
  const r = radius.toFixed(2);
  return `M${fixed(bowlPoint(from, width, height, isRTL))} A${r} ${r} 0 ${large} ${sweep} ${fixed(bowlPoint(to, width, height, isRTL))}`;
};
