import type { TimingConfig } from "@/types/alarm";

export interface PrayerTrigger {
  prayerDate: Date;
  triggerDate: Date;
}

export const applyTimingOffset = (
  prayerDate: Date,
  timing: TimingConfig | null | undefined
): Date => {
  if (timing?.mode === "beforePrayerTime" && timing.minutesBefore && timing.minutesBefore > 0) {
    return new Date(prayerDate.getTime() - timing.minutesBefore * 60 * 1000);
  }
  return prayerDate;
};

// Picks the first candidate whose *trigger* (prayer time minus offset) is still in the
// future — the offset must be part of the selection, otherwise a "30 min before" alarm
// that just fired re-selects today's still-future prayer, lands in the past, and the
// next occurrence never gets scheduled.
export const pickNextTrigger = (
  prayerDates: (Date | null | undefined)[],
  timing: TimingConfig | null | undefined,
  now: number = Date.now()
): PrayerTrigger | null => {
  for (const prayerDate of prayerDates) {
    if (!prayerDate) continue;
    const triggerDate = applyTimingOffset(prayerDate, timing);
    if (triggerDate.getTime() > now) {
      return { prayerDate, triggerDate };
    }
  }
  return null;
};
