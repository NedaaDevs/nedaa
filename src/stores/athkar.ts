import { create } from "zustand";
import { persist, createJSONStorage, devtools, subscribeWithSelector } from "zustand/middleware";
import Storage from "expo-sqlite/kv-store";

// Types
import { AthkarActions, AthkarState } from "@/types/athkar";

// Constants
import { ATHKAR_TYPE } from "@/constants/Athkar";

type AthkarStore = AthkarState & AthkarActions;

export const useAthkarStore = create<AthkarStore>()(
  devtools(
    subscribeWithSelector(
      persist(
        (set, get) => ({
          athkarList: [],
          currentProgress: [],
          streak: {
            currentStreak: 0,
            longestStreak: 0,
            lastCompletedDate: null,
            isPaused: false,
            toleranceDays: 1,
          },
          focusMode: false,
          currentAthkarIndex: 0,
          currentType: ATHKAR_TYPE.MORNING,

          setAthkarList: (list) => set({ athkarList: list }),

          incrementCount: (athkarId) =>
            set((state) => {
              const progress = state.currentProgress.map((p) =>
                p.athkarId === athkarId
                  ? {
                      ...p,
                      currentCount: Math.min(
                        p.currentCount + 1,
                        state.athkarList.find((a) => a.id === athkarId)?.count || 0
                      ),
                      completed:
                        p.currentCount + 1 >=
                        (state.athkarList.find((a) => a.id === athkarId)?.count || 0),
                    }
                  : p
              );

              // Auto move to next if completed in focus mode
              const filteredAthkar = state.athkarList.filter(
                (a) => a.type === state.currentType || a.type === ATHKAR_TYPE.ALL
              );
              const currentAthkar = filteredAthkar[state.currentAthkarIndex];
              const currentProgressItem = progress.find((p) => p.athkarId === currentAthkar?.id);

              if (state.focusMode && currentProgressItem?.completed) {
                setTimeout(() => get().moveToNext(), 300);
              }

              return { currentProgress: progress };
            }),

          decrementCount: (athkarId) =>
            set((state) => ({
              currentProgress: state.currentProgress.map((p) =>
                p.athkarId === athkarId
                  ? {
                      ...p,
                      currentCount: Math.max(p.currentCount - 1, 0),
                      completed: false,
                    }
                  : p
              ),
            })),

          toggleFocusMode: () => set((state) => ({ focusMode: !state.focusMode })),

          moveToNext: () =>
            set((state) => {
              const filteredAthkar = state.athkarList.filter(
                (a) => a.type === state.currentType || a.type === ATHKAR_TYPE.ALL
              );
              return {
                currentAthkarIndex: Math.min(
                  state.currentAthkarIndex + 1,
                  filteredAthkar.length - 1
                ),
              };
            }),

          moveToPrevious: () =>
            set((state) => ({
              currentAthkarIndex: Math.max(state.currentAthkarIndex - 1, 0),
            })),

          setCurrentAthkarIndex: (index: number) => set({ currentAthkarIndex: index }),

          initializeSession: (type) =>
            set((state) => {
              const filteredAthkar = state.athkarList.filter(
                (a) => a.type === type || a.type === "all"
              );

              const progress = filteredAthkar.map((athkar) => ({
                id: `${athkar.id}-${new Date().toISOString()}`,
                athkarId: athkar.id,
                currentCount: 0,
                completed: false,
                date: new Date().toISOString(),
              }));

              return {
                currentType: type,
                currentProgress: progress,
                currentAthkarIndex: 0,
                focusMode: false,
              };
            }),

          completeSession: () =>
            set(() => {
              get().updateStreak();
              return { currentProgress: [], currentAthkarIndex: 0 };
            }),

          updateStreak: () =>
            set((state) => {
              const today = new Date().toDateString();
              const lastDate = state.streak.lastCompletedDate
                ? new Date(state.streak.lastCompletedDate)
                : null;

              // Check if already completed today
              if (lastDate && today === lastDate.toDateString()) {
                return state; // No change if already completed today
              }

              const daysDiff = lastDate
                ? Math.floor((new Date().getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))
                : 0;

              let newCurrentStreak = state.streak.currentStreak;

              if (!state.streak.isPaused) {
                if (!lastDate) {
                  // First time
                  newCurrentStreak = 1;
                } else if (daysDiff === 1) {
                  // Next day, increment
                  newCurrentStreak += 1;
                } else if (daysDiff <= state.streak.toleranceDays + 1) {
                  // Within tolerance
                  newCurrentStreak += 1;
                } else {
                  // Streak broken
                  newCurrentStreak = 1;
                }
              }

              return {
                streak: {
                  ...state.streak,
                  currentStreak: newCurrentStreak,
                  longestStreak: Math.max(newCurrentStreak, state.streak.longestStreak),
                  lastCompletedDate: today,
                },
              };
            }),

          pauseStreak: () =>
            set((state) => ({
              streak: { ...state.streak, isPaused: true },
            })),

          resumeStreak: () =>
            set((state) => ({
              streak: { ...state.streak, isPaused: false },
            })),

          updateToleranceDays: (days: number) =>
            set((state) => ({
              streak: { ...state.streak, toleranceDays: days },
            })),

          resetProgress: () =>
            set((state) => ({
              currentProgress: state.currentProgress.map((p) => ({
                ...p,
                currentCount: 0,
                completed: false,
              })),
            })),
        }),
        {
          name: "athkar-storage",
          storage: createJSONStorage(() => Storage),
          partialize: (state) => ({
            athkarList: state.athkarList,
            streak: state.streak,
            // Don't persist current session data
          }),
        }
      )
    )
  )
);
