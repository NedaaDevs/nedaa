const MS_PER_DAY = 86_400_000;

// Local calendar date as YYYY-MM-DD in the device timezone.
export const toLocalDateISO = (timestamp: number): string => {
  const d = new Date(timestamp);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const dateOnlyUTC = (iso: string): number => {
  const [year, month, day] = iso.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
};

// Standard streak rule on local calendar dates: same day is a no-op, a
// consecutive day extends the streak, any other gap restarts at 1.
export const computeNextStreak = (
  lastDateISO: string | null,
  todayISO: string,
  current: number
): number => {
  if (!lastDateISO) return 1;
  const diffDays = Math.round((dateOnlyUTC(todayISO) - dateOnlyUTC(lastDateISO)) / MS_PER_DAY);
  if (diffDays === 0) return current;
  if (diffDays === 1) return current + 1;
  return 1;
};
