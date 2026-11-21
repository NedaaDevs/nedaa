import { create } from "zustand";
import { createJSONStorage, devtools, persist } from "zustand/middleware";
import Storage from "expo-sqlite/kv-store";
import type { AlarmOutcome } from "expo-alarm";

import { nextFajrStreak, type FajrStreak } from "@/utils/fajrStreak";
import { toLocalDateISO } from "@/utils/streak";

const FRESHNESS_WINDOW_MS = 60 * 60 * 1000;

type AlarmStreakState = FajrStreak & {
  recordFajrOutcome: (triggerTime: number, outcome: AlarmOutcome) => void;
};

export const useAlarmStreakStore = create<AlarmStreakState>()(
  devtools(
    persist(
      (set, get) => ({
        streak: 0,
        lastSuccessDate: null,
        lastHeldDate: null,
        bestStreak: 0,

        recordFajrOutcome: (triggerTime, outcome) => {
          const age = Date.now() - triggerTime;
          // An ending outside the hour after the trigger is a missed morning.
          if (age < 0 || age > FRESHNESS_WINDOW_MS) return;

          const { streak, bestStreak, lastSuccessDate, lastHeldDate } = get();
          const current = { streak, bestStreak, lastSuccessDate, lastHeldDate };
          set(nextFajrStreak(current, outcome, toLocalDateISO(Date.now())));
        },
      }),
      {
        name: "alarm-streak-storage",
        storage: createJSONStorage(() => Storage),
        merge: (persisted, current) => ({
          ...current,
          ...(persisted as object),
        }),
      }
    ),
    { name: "alarm-streak-store" }
  )
);
