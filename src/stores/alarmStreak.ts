import { create } from "zustand";
import { createJSONStorage, devtools, persist } from "zustand/middleware";
import Storage from "expo-sqlite/kv-store";
import { computeNextStreak, toLocalDateISO } from "@/utils/streak";

// A completion only counts as waking up when it lands within an hour of the
// alarm firing; this excludes the stale-alarm auto-completion path (>2h old),
// so a skipped Fajr never inflates the streak.
const FRESHNESS_WINDOW_MS = 60 * 60 * 1000;

interface AlarmStreakState {
  streak: number;
  lastSuccessDate: string | null;
  bestStreak: number;
  recordFajrSuccess: (triggerTime: number) => void;
}

export const useAlarmStreakStore = create<AlarmStreakState>()(
  devtools(
    persist(
      (set, get) => ({
        streak: 0,
        lastSuccessDate: null,
        bestStreak: 0,

        recordFajrSuccess: (triggerTime) => {
          if (Date.now() - triggerTime > FRESHNESS_WINDOW_MS) return;

          const todayISO = toLocalDateISO(Date.now());
          const { lastSuccessDate, streak, bestStreak } = get();
          const nextStreak = computeNextStreak(lastSuccessDate, todayISO, streak);

          set({
            streak: nextStreak,
            lastSuccessDate: todayISO,
            bestStreak: Math.max(bestStreak, nextStreak),
          });
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
