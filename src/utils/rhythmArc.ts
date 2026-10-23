import { RHYTHM_ARC } from "@/constants/Timeline";

type Point = { x: number; y: number };

/** Steps the curve is measured in; enough that a share lands within a point. */
const SAMPLES = 96;

const bezier = (t: number, width: number): Point => {
  const { inset, base, crest, controls } = RHYTHM_ARC;
  const xs = [inset, width * controls[0], width * controls[1], width - inset];
  const ys = [base, crest, crest, base];
  const u = 1 - t;
  const weights = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
  const sum = (values: number[]) => values.reduce((total, v, i) => total + v * weights[i], 0);
  return { x: sum(xs), y: sum(ys) };
};

/** The curve sampled evenly, with the length walked to each sample. */
const measure = (width: number) => {
  const points = Array.from({ length: SAMPLES + 1 }, (_, i) => bezier(i / SAMPLES, width));
  const walked = [0];
  for (let i = 1; i < points.length; i++) {
    const [a, b] = [points[i - 1], points[i]];
    walked.push(walked[i - 1] + Math.hypot(b.x - a.x, b.y - a.y));
  }
  return { points, walked };
};

type Measured = ReturnType<typeof measure>;

const pointOn = ({ points, walked }: Measured, share: number, width: number, isRTL: boolean) => {
  const target = Math.min(Math.max(share, 0), 1) * walked[SAMPLES];
  const i = Math.max(
    1,
    walked.findIndex((length) => length >= target)
  );
  const span = walked[i] - walked[i - 1];
  const f = span === 0 ? 0 : (target - walked[i - 1]) / span;
  const x = points[i - 1].x + (points[i].x - points[i - 1].x) * f;
  const y = points[i - 1].y + (points[i].y - points[i - 1].y) * f;
  // RTL runs the day from the end edge.
  return { x: isRTL ? width - x : x, y };
};

/** The point a share of the day falls on, placed by length along the curve. */
export const arcPoint = (share: number, width: number, isRTL: boolean): Point =>
  pointOn(measure(width), share, width, isRTL);

const fixed = ({ x, y }: Point) => `${x.toFixed(2)} ${y.toFixed(2)}`;

/** A path along the curve from one share of the day to another. */
export const arcPath = (from: number, to: number, width: number, isRTL: boolean): string => {
  const measured = measure(width);
  const steps = Math.max(1, Math.ceil((to - from) * SAMPLES));
  return Array.from({ length: steps + 1 }, (_, i) =>
    pointOn(measured, from + ((to - from) * i) / steps, width, isRTL)
  )
    .map((point, i) => `${i === 0 ? "M" : "L"}${fixed(point)}`)
    .join(" ");
};
