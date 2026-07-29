/**
 * Geometry for the home-screen prayer arc.
 *
 * The arc is a bowl opening downward: it starts at the lower left, sweeps
 * clockwise over the top, and ends at the lower right. Progress always runs
 * left to right — it tracks the sun, not the reading direction, so it must not
 * mirror under RTL.
 */

export const ARC_START_DEG = 150;
export const ARC_SWEEP_DEG = 240;

// SVG angles: 0° points right and grow clockwise, because the y axis points down.
const polar = (cx: number, cy: number, radius: number, degrees: number) => {
  const radians = (degrees * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(radians),
    y: cy + radius * Math.sin(radians),
  };
};

/**
 * A single SVG arc command. One command can't express a full circle, so the
 * sweep is capped just short of it.
 */
export const arcPath = (
  cx: number,
  cy: number,
  radius: number,
  startDeg: number,
  sweepDeg: number
): string => {
  const sweep = Math.min(Math.max(sweepDeg, 0), 359.99);
  const start = polar(cx, cy, radius, startDeg);
  const end = polar(cx, cy, radius, startDeg + sweep);
  const largeArc = sweep > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`;
};

/**
 * How far the current moment sits between two prayers, clamped to 0–1.
 *
 * Returns 0 for a non-positive window, which covers missing data and the case
 * where both timings resolve to the same instant.
 */
export const prayerElapsedFraction = (from: Date, to: Date, now: Date): number => {
  const start = from.getTime();
  const end = to.getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  const fraction = (now.getTime() - start) / (end - start);
  return Math.min(Math.max(fraction, 0), 1);
};
