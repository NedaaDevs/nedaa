import { create } from "zustand";
import { persist, createJSONStorage, devtools } from "zustand/middleware";
import Storage from "expo-sqlite/kv-store";

// Types
import { Athkar, AthkarActions, AthkarState } from "@/types/athkar";

// Constants
import { ATHKAR_TYPE } from "@/constants/Athkar";

// Database
import { AthkarStreakDB } from "@/services/athkar-db";

// Stores
import locationStore from "@/stores/location";

// Utils
import {
  filterAthkarByType,
  clampIndex,
  generateReferenceId,
  extractBaseId,
  isAthkarCompleted,
  createProgressItem,
  filterProgressByType,
  filterTodayProgress,
  isSessionComplete,
  getTimestampForTimezone,
} from "@/utils/athkar";
import { dateToInt, timeZonedNow } from "@/utils/date";

type AthkarStore = AthkarState & AthkarActions;

const getTodayInt = (timezone: string): number => {
  const zonedDate = timeZonedNow(timezone);
  return dateToInt(zonedDate);
};

const dateIntToString = (dateInt: number): string => {
  const dateStr = dateInt.toString();
  return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
};

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
          showStreak: true,
        },

        // Initialize DB and load streak data
        initializeStore: async () => {
          try {
            await AthkarStreakDB.initialize();

            // Load streak data from DB
            const streakData = await AthkarStreakDB.getStreakData();
            if (streakData) {
              set({
                streak: {
                  currentStreak: streakData.current_streak,
                  longestStreak: streakData.longest_streak,
                  lastCompletedDate: streakData.last_streak_date
                    ? dateIntToString(streakData.last_streak_date)
                    : null,
                  isPaused: streakData.is_paused === 1,
                  toleranceDays: streakData.tolerance_days,
                },
              });

              await get().cleanUpOldData();
            }
          } catch (error) {
            console.error("Error initializing store:", error);
          }
        },

        updateStreakForCompletedDay: async () => {
          const timezone = locationStore.getState().locationDetails.timezone;
          const todayInt = getTodayInt(timezone);

          // Check if already marked as completed
          const alreadyCompleted = await AthkarStreakDB.isDayCompleted(todayInt);
          if (alreadyCompleted) return;

          // Add to completed days
          await AthkarStreakDB.addCompletedDay(todayInt);

          // Get current streak data
          const streakData = await AthkarStreakDB.getStreakData();
          if (!streakData) return;

          // Determine if we should increment or reset streak
          if (!streakData.last_streak_date) {
            // First ever completion
            await AthkarStreakDB.incrementStreak(todayInt);
          } else {
            const daysSinceLastStreak = todayInt - streakData.last_streak_date;

            if (daysSinceLastStreak === 1) {
              // Consecutive day
              await AthkarStreakDB.incrementStreak(todayInt);
            } else if (daysSinceLastStreak === 0) {
              // Same day, already handled above
              return;
            } else if (
              streakData.tolerance_days > 0 &&
              daysSinceLastStreak <= streakData.tolerance_days + 1 &&
              !streakData.is_paused
            ) {
              // Within tolerance
              await AthkarStreakDB.incrementStreak(todayInt);
            } else {
              // Streak broken - reset to 1
              await AthkarStreakDB.resetCurrentStreak();
              await AthkarStreakDB.incrementStreak(todayInt);
            }
          }

          // Reload streak data to UI
          await get().reloadStreakFromDB();
        },

        // Reload streak from DB
        reloadStreakFromDB: async () => {
          const streakData = await AthkarStreakDB.getStreakData();
          if (streakData) {
            set({
              streak: {
                currentStreak: streakData.current_streak,
                longestStreak: streakData.longest_streak,
                lastCompletedDate: streakData.last_streak_date
                  ? dateIntToString(streakData.last_streak_date)
                  : null,
                isPaused: streakData.is_paused === 1,
                toleranceDays: streakData.tolerance_days,
              },
            });
          }
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

        checkAndUpdateDailyProgress: async () => {
          const state = get();
          const todayProgress = filterTodayProgress(state.currentProgress);

          const morningCompleted = isSessionComplete(todayProgress, ATHKAR_TYPE.MORNING);
          const eveningCompleted = isSessionComplete(todayProgress, ATHKAR_TYPE.EVENING);

          const newTodayCompleted = {
            morning: morningCompleted,
            evening: eveningCompleted,
          };

          set({ todayCompleted: newTodayCompleted });

          // If both sessions completed, update streak
          if (morningCompleted && eveningCompleted) {
            await get().updateStreakForCompletedDay();
          }
        },

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
        updateStreak: async () => {
          await get().updateStreakForCompletedDay();
        },

        pauseStreak: async () => {
          await AthkarStreakDB.updateStreakSettings({ isPaused: true });
          await get().reloadStreakFromDB();
        },

        resumeStreak: async () => {
          await AthkarStreakDB.updateStreakSettings({ isPaused: false });
          await get().reloadStreakFromDB();
        },

        updateToleranceDays: async (days: number) => {
          await AthkarStreakDB.updateStreakSettings({ toleranceDays: days });
          await get().reloadStreakFromDB();
        },

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

        completeSession: async () => {
          await get().checkAndUpdateDailyProgress();
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

        // Force recalculation from history (for recovery/debugging)
        forceRecalculateStreak: async () => {
          await AthkarStreakDB.forceUpdateStreakFromHistory();
          await get().reloadStreakFromDB();
        },

        cleanUpOldData: async () => {
          await AthkarStreakDB.cleanOldCompletedDays();
        },
      }),
      {
        name: "athkar-storage",
        storage: createJSONStorage(() => Storage),
        partialize: (state) => ({
          athkarList: state.athkarList,
          currentProgress: state.currentProgress,
          todayCompleted: state.todayCompleted,
          settings: state.settings,
          // NOTE: streak is NOT persisted here, it's in DB
        }),
        onRehydrateStorage: () => (state) => {
          // Initialize DB and load streak after rehydration
          state?.initializeStore();
        },
      }
    )
  )
);
