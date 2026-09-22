// Pure progress geometry, free of Tamagui imports so jest can test it.

/** Where `value` sits in [min, max], as a percentage of the track. */
export const progressPercent = (value: number, min: number, max: number): number => {
  const span = max - min;
  if (!Number.isFinite(span) || span <= 0) return 0;

  const clamped = Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
  return ((clamped - min) / span) * 100;
};
