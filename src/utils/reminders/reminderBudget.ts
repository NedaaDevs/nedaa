import type { QuranReminder } from "@/types/quranReminders";

// Each enabled reminder is one native OS-repeating notification (one iOS slot),
// reserved out of the prayer budget so reminders are never crowded out.
export const enabledQuranReminderCount = (reminders: QuranReminder[]): number =>
  reminders.filter((r) => r.enabled).length;
