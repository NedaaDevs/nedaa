import { BEAD_MOVE, type BeadMove, SUBHA_BEADS } from "@/constants/AthkarSubha";

const { ROUND, GAP, LIGHT_AT, MID_STOP } = SUBHA_BEADS;

type StringBox = { WIDTH: number; BEAD: number; SAG: number };
type BeadColours = { light: string; mid: string; edge: string };

/** The beads on a dhikr's string: one per repeat, up to a round. */
export const beadsOn = (target: number): number => Math.min(Math.max(target, 0), ROUND);

/** Beads counted across this round; a reached target rests them all. */
export const beadsAcross = (count: number, target: number): number => {
  const beads = beadsOn(target);
  if (beads === 0) return 0;
  return count >= target ? beads : count % beads;
};

/** The dots under a long count's string, one per round, and those passed. */
export const tensOf = (count: number, target: number): { dots: number; lit: number } => {
  if (target <= ROUND) return { dots: 0, lit: 0 };
  const dots = Math.floor(target / ROUND);
  return { dots, lit: Math.min(Math.floor(count / ROUND), dots) };
};

const atRoundEnd = (count: number, target: number) =>
  count > 0 && count < target && beadsAcross(count, target) === 0;

const roundOf = (count: number) => Math.floor(count / ROUND);

/** The move from the count `before` (null on the first draw) to `count`. */
export const beadMove = (before: number | null, count: number, target: number): BeadMove => {
  if (before === null) return BEAD_MOVE.PLACE;
  if (count > before && count < target && roundOf(count) > roundOf(before)) return BEAD_MOVE.SWEEP;
  if (count < before && atRoundEnd(before, target)) return BEAD_MOVE.UNWIND;
  return BEAD_MOVE.SLIDE;
};

/** How far the string hangs under a bead whose left edge is at `x`. */
export const beadHeight = (x: number, { WIDTH, BEAD, SAG }: StringBox): number => {
  "worklet";
  const u = (x + BEAD / 2 - WIDTH / 2) / (WIDTH / 2);
  return SAG * (1 - u * u);
};

/** A bead's x and y: waiting beads at the start, counted ones at the end. */
export const beadPoint = (
  index: number,
  across: number,
  beads: number,
  box: StringBox,
  rtl: boolean
): { x: number; y: number } => {
  const { WIDTH, BEAD } = box;
  const step = BEAD + GAP;
  // Drawn from the right; the left-to-right reading mirrors it.
  const fromRight = index < across ? index * step : WIDTH - BEAD - (beads - 1 - index) * step;
  const x = rtl ? fromRight : WIDTH - BEAD - fromRight;
  return { x, y: beadHeight(x, box) };
};

/** The string through the beads' centres, as an SVG path. */
export const stringPath = ({ WIDTH, BEAD, SAG }: StringBox): string =>
  `M0 ${BEAD / 2} Q ${WIDTH / 2} ${BEAD / 2 + 2 * SAG} ${WIDTH} ${BEAD / 2}`;

const round1 = (value: number) => Math.round(value * 10) / 10;

/** A bead's body: light from its upper left to its far edge. */
export const beadGradient = (size: number, { light, mid, edge }: BeadColours): string => {
  const x = size * LIGHT_AT.X;
  const y = size * LIGHT_AT.Y;
  // To the farthest corner, as CSS sizes a circle.
  const reach = round1(Math.hypot(size - x, size - y));
  return `radial-gradient(${reach}px ${reach}px at ${round1(x)}px ${round1(y)}px, ${light} 0%, ${mid} ${MID_STOP * 100}%, ${edge} 100%)`;
};
