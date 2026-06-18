import { create } from "zustand";
import Storage from "expo-sqlite/kv-store";
import { createJSONStorage, persist } from "zustand/middleware";

import { QURAN_REMINDER_ID, Weekday } from "@/enums/quranReminders";
import type { QuranReminder, QuranRemindersStore } from "@/types/quranReminders";
import { rearmReminders } from "@/utils/reminders/rearmReminders";

const seededReminders: QuranReminder[] = [
  {
    id: QURAN_REMINDER_ID,
    target: { kind: "surah", surah: 18 },
    schedule: { freq: "weekly", weekday: Weekday.FRIDAY, hour: 9, minute: 0 },
    enabled: false,
  },
];

export const useQuranRemindersStore = create<QuranRemindersStore>()(
  persist(
    (set, get) => ({
      reminders: seededReminders,

      getReminder: (id) => get().reminders.find((r) => r.id === id),

      setEnabled: async (id, enabled) => {
        set((state) => ({
          reminders: state.reminders.map((r) => (r.id === id ? { ...r, enabled } : r)),
        }));
        await rearmReminders();
      },

      setTime: (id, hour, minute) => {
        set((state) => ({
          reminders: state.reminders.map((r) =>
            r.id === id ? { ...r, schedule: { ...r.schedule, hour, minute } } : r
          ),
        }));
        void rearmReminders();
      },
    }),
    {
      name: "quran-reminders-storage",
      storage: createJSONStorage(() => Storage),
      // Keep seeded definitions; carry over enabled + schedule from persisted by id
      // so new seeded reminders appear and renamed fields don't break old data.
      merge: (persisted, current) => {
        const prev = persisted as { reminders?: QuranReminder[] } | undefined;
        if (!prev?.reminders) return current;
        const byId = new Map(prev.reminders.map((r) => [r.id, r]));
        return {
          ...current,
          reminders: current.reminders.map((seed) => {
            const saved = byId.get(seed.id);
            return saved ? { ...seed, enabled: saved.enabled, schedule: saved.schedule } : seed;
          }),
        };
      },
    }
  )
);
