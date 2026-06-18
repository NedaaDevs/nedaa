import type { ReminderSchedule } from "@/types/quranReminders";

const atTime = (base: Date, hour: number, minute: number): Date =>
  new Date(base.getFullYear(), base.getMonth(), base.getDate(), hour, minute, 0, 0);

// Next local fire time strictly after `now`. Daily rolls to tomorrow once today's
// time has passed; weekly advances to the next matching weekday (same day only if
// its time is still ahead). Caller supplies `now` so the result is deterministic.
export const computeNextOccurrence = (schedule: ReminderSchedule, now: Date): Date => {
  if (schedule.freq === "daily") {
    const today = atTime(now, schedule.hour, schedule.minute);
    if (today > now) return today;
    return atTime(
      new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1),
      schedule.hour,
      schedule.minute
    );
  }

  const deltaDays = (schedule.weekday - now.getDay() + 7) % 7;
  const candidate = atTime(
    new Date(now.getFullYear(), now.getMonth(), now.getDate() + deltaDays),
    schedule.hour,
    schedule.minute
  );
  if (deltaDays === 0 && candidate <= now) {
    return atTime(
      new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7),
      schedule.hour,
      schedule.minute
    );
  }
  return candidate;
};
