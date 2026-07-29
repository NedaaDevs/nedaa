/**
 * A remaining duration as `H:MM`.
 *
 * Digits only, deliberately: the home screen sets this at display size, where a
 * phrase like "about 2 hours" wraps, and digits need no unit words translating.
 * Negative input clamps to zero rather than counting backwards.
 *
 * Returns Western digits; callers apply `formatNumberToLocale` so the locale and
 * numeral preference stay tracked where they are read.
 */
export const formatHoursMinutes = (totalSeconds: number): string => {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}:${String(minutes).padStart(2, "0")}`;
};
