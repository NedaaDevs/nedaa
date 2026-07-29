// Bowl-shaped arc: lower left, clockwise over the top, lower right. Progress
// runs left to right and must not mirror under RTL — it tracks the sun.

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

// Sweep is capped just short of 360: one arc command can't express a full circle.
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

// Position between two timings, clamped to 0–1. A non-positive window gives 0.
export const elapsedWindowFraction = (from: Date, to: Date, now: Date): number => {
  const start = from.getTime();
  const end = to.getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  const fraction = (now.getTime() - start) / (end - start);
  return Math.min(Math.max(fraction, 0), 1);
};
