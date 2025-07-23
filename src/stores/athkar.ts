import { create } from "zustand";
import { persist, createJSONStorage, devtools } from "zustand/middleware";
import Storage from "expo-sqlite/kv-store";

// Types
import { Athkar, AthkarActions, AthkarState } from "@/types/athkar";

// Constants
import { ATHKAR_TYPE } from "@/constants/Athkar";

// Utils
import {
  getToday,
  filterAthkarByType,
  clampIndex,
  generateReferenceId,
  extractBaseId,
  isAthkarCompleted,
  areBothSessionsComplete,
  calculateDaysDifference,
  createProgressItem,
  filterProgressByType,
  filterTodayProgress,
  isSessionComplete,
  shouldIncrementStreak,
  getTimestampForTimezone,
} from "@/utils/athkar";

type AthkarStore = AthkarState & AthkarActions;

export const useAthkarStore = create<AthkarStore>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial State
        athkarList: [],
        currentProgress: [],
        streak: {
          currentStreak: 0,
          longestStreak: 0,
          lastCompletedDate: null,
          isPaused: false,
          toleranceDays: 0, // TODO: see if we should allow this
        },
        focusMode: false,
        currentAthkarIndex: 0,
        currentType: ATHKAR_TYPE.MORNING,
        todayCompleted: {
          morning: false,
          evening: false,
        },
        settings: {
          autoMoveToNext: true,
          showStreak: false,
        },

        setAthkarList: (list) => set({ athkarList: list }),
        setCurrentType: (type) => set({ currentType: type }),
        setCurrentAthkarIndex: (index: number) => set({ currentAthkarIndex: index }),
        toggleFocusMode: () => set((state) => ({ focusMode: !state.focusMode })),

        moveToNext: () =>
          set((state) => {
            const filteredAthkar = filterAthkarByType(state.athkarList, state.currentType);
            const newIndex = clampIndex(state.currentAthkarIndex + 1, filteredAthkar.length);
            return { currentAthkarIndex: newIndex };
          }),

        // NOTE: Currently not used
        moveToPrevious: () =>
          set((state) => ({
            currentAthkarIndex: clampIndex(state.currentAthkarIndex - 1, Infinity),
          })),

        incrementCount: (athkarId) =>
          set((state) => {
            const referenceId = generateReferenceId(athkarId, state.currentType);
            const baseId = extractBaseId(athkarId);

            // Find the athkar definition
            const athkar = state.athkarList.find((a) => a.id === baseId);
            if (!athkar) return state;

            // Update progress
            const updatedProgress = state.currentProgress.map((p) => {
              if (p.athkarId === referenceId) {
                const newCount = Math.min(p.currentCount + 1, athkar.count);
                return {
                  ...p,
                  currentCount: newCount,
                  completed: isAthkarCompleted(newCount, athkar.count),
                  lastUpdated: getTimestampForTimezone(),
                };
              }
              return p;
            });

            // Handle auto-move in focus mode
            const currentProgress = updatedProgress.find((p) => p.athkarId === referenceId);
            if (state.focusMode && currentProgress?.completed && state.settings.autoMoveToNext) {
              requestAnimationFrame(() => get().moveToNext());
            }

            // Update daily completion status
            requestAnimationFrame(() => get().checkAndUpdateDailyProgress());

            return { currentProgress: updatedProgress };
          }),

        decrementCount: (athkarId) =>
          set((state) => {
            const referenceId = generateReferenceId(athkarId, state.currentType);

            const updatedProgress = state.currentProgress.map((p) => {
              if (p.athkarId === referenceId) {
                return {
                  ...p,
                  currentCount: Math.max(p.currentCount - 1, 0),
                  completed: false,
                  lastUpdated: getTimestampForTimezone(),
                };
              }
              return p;
            });

            return { currentProgress: updatedProgress };
          }),

        initializeSession: (type) =>
          set((state) => {
            const todayProgress = filterTodayProgress(state.currentProgress);
            const filteredAthkar = filterAthkarByType(state.athkarList, type);

            // Check if we already have progress for this type today
            const existingTypeProgress = filterProgressByType(todayProgress, type);

            let finalProgress;

            if (existingTypeProgress.length > 0) {
              // Use existing progress
              finalProgress = todayProgress;
            } else {
              // Create new progress for this session
              const newSessionProgress = filteredAthkar.map((athkar: Athkar) =>
                createProgressItem(athkar, type)
              );

              // Merge with other type progress from today
              const otherTypeProgress = todayProgress.filter(
                (p) => !p.athkarId.includes(`-${type}`)
              );
              finalProgress = [...otherTypeProgress, ...newSessionProgress];
            }

            return {
              currentType: type,
              currentProgress: finalProgress,
              currentAthkarIndex: 0,
              focusMode: false,
            };
          }),

        checkAndUpdateDailyProgress: () =>
          set((state) => {
            const todayProgress = filterTodayProgress(state.currentProgress);

            const morningCompleted = isSessionComplete(todayProgress, ATHKAR_TYPE.MORNING);
            const eveningCompleted = isSessionComplete(todayProgress, ATHKAR_TYPE.EVENING);

            const newTodayCompleted = {
              morning: morningCompleted,
              evening: eveningCompleted,
            };

            // Update streak if both sessions completed and it's a new completion
            if (
              morningCompleted &&
              eveningCompleted &&
              (!state.todayCompleted.morning || !state.todayCompleted.evening)
            ) {
              requestAnimationFrame(() => get().updateStreak());
            }

            return { todayCompleted: newTodayCompleted };
          }),

        checkAndResetDailyProgress: () =>
          set((state) => {
            const todayProgress = filterTodayProgress(state.currentProgress);

            // If no progress from today, reset everything
            if (todayProgress.length === 0) {
              return {
                ...state,
                currentProgress: [],
                todayCompleted: { morning: false, evening: false },
                currentAthkarIndex: 0,
              };
            }

            // Keep today's progress
            return { ...state, currentProgress: todayProgress };
          }),

        // Streak Management
        updateStreak: () =>
          set((state) => {
            const today = getToday();
            const lastDateStr = state.streak.lastCompletedDate;

            // Don't update if already completed today
            if (lastDateStr === today) return state;

            // Only update if both sessions are complete
            if (!areBothSessionsComplete(state.currentProgress)) {
              return state;
            }

            let newCurrentStreak = 1; // Start with 1 for today

            if (lastDateStr && !state.streak.isPaused) {
              const daysDiff = calculateDaysDifference(lastDateStr, today);

              if (
                shouldIncrementStreak(daysDiff, state.streak.toleranceDays, state.streak.isPaused)
              ) {
                newCurrentStreak = state.streak.currentStreak + 1;
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

        // NOTE: Added for future use if we allow streak pause/resume.
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

        // Utility Actions
        resetProgress: () =>
          set((state) => ({
            currentProgress: state.currentProgress.map((p) => ({
              ...p,
              currentCount: 0,
              completed: false,
              lastUpdated: new Date().toISOString(),
            })),
          })),

        completeSession: () => {
          get().updateStreak();
        },

        // Settings
        toggleAutoMove: () =>
          set((state) => ({
            settings: {
              ...state.settings,
              autoMoveToNext: !state.settings.autoMoveToNext,
            },
          })),

        toggleShowStreak: () =>
          set((state) => ({
            settings: {
              ...state.settings,
              showStreak: !state.settings.showStreak,
            },
          })),
      }),
      {
        name: "athkar-storage",
        storage: createJSONStorage(() => Storage),
        partialize: (state) => ({
          athkarList: state.athkarList,
          currentProgress: state.currentProgress,
          streak: state.streak,
          todayCompleted: state.todayCompleted,
          settings: state.settings,
        }),
      }
    )
  )
);
