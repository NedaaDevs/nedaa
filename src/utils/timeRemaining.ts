/** Whole seconds as `m:ss`, as the alarm's countdowns draw them. */
export const formatTimeRemaining = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
};
