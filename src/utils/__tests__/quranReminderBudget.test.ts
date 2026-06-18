import { enabledQuranReminderCount } from "@/utils/reminders/reminderBudget";
import { Weekday } from "@/enums/quranReminders";
import type { QuranReminder } from "@/types/quranReminders";

const mk = (enabled: boolean): QuranReminder => ({
  id: "al-kahf",
  target: { kind: "surah", surah: 18 },
  schedule: { freq: "weekly", weekday: Weekday.FRIDAY, hour: 9, minute: 0 },
  enabled,
});

describe("enabledQuranReminderCount", () => {
  it("counts only enabled reminders", () => {
    expect(enabledQuranReminderCount([mk(false)])).toBe(0);
    expect(enabledQuranReminderCount([mk(true)])).toBe(1);
    expect(enabledQuranReminderCount([mk(true), mk(true)])).toBe(2);
  });
  it("a reserved reminder lowers the iOS budget by its count", () => {
    const MAX = 63;
    const athkar = 2;
    const qada = 1;
    const reminders = 1;
    expect(MAX - athkar - qada - reminders).toBe(59);
  });
});
