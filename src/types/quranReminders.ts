import type { WeekdayValue } from "@/enums/quranReminders";

export type ReminderSchedule =
  | { freq: "weekly"; weekday: WeekdayValue; hour: number; minute: number }
  | { freq: "daily"; hour: number; minute: number };

export type ReminderTarget = { kind: "surah"; surah: number } | { kind: "khatmah" };

export type QuranReminder = {
  id: string;
  target: ReminderTarget;
  schedule: ReminderSchedule;
  enabled: boolean;
};

export type QuranRemindersState = {
  reminders: QuranReminder[];
};

export type QuranRemindersActions = {
  setEnabled: (id: string, enabled: boolean) => Promise<void>;
  setTime: (id: string, hour: number, minute: number) => void;
  getReminder: (id: string) => QuranReminder | undefined;
};

export type QuranRemindersStore = QuranRemindersState & QuranRemindersActions;
