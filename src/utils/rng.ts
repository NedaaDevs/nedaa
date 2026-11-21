/** A source of draws in [0, 1), like `Math.random`. */
export type Rng = () => number;

/** Mulberry32: one seed always yields one sequence, in any build. */
export const seededRng = (seed: number): Rng => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** A whole number from `min` to `max`, both included. */
export const drawInt = (rng: Rng, min: number, max: number): number =>
  min + Math.floor(rng() * (max - min + 1));

/** Fisher–Yates from the last item down; the input is left untouched. */
export const shuffled = <T>(items: readonly T[], rng: Rng): T[] => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = drawInt(rng, 0, i);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};
