// Remaining duration as `H:MM`, clamped at zero. Digits only so it fits the
// display-size hero and needs no translation; callers localize the numerals.
export const formatHoursMinutes = (totalSeconds: number): string => {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}:${String(minutes).padStart(2, "0")}`;
};
