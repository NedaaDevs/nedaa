import { create } from "zustand";
import { persist, createJSONStorage, devtools } from "zustand/middleware";
import Storage from "expo-sqlite/kv-store";

// Types
import { Athkar, AthkarActions, AthkarState } from "@/types/athkar";

// Constants
import { ATHKAR_TYPE } from "@/constants/Athkar";

// Services
import { AthkarDB } from "@/services/athkar-db";

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
  isSessionComplete,
  getTimestampForTimezone,
  getTodayInt,
  dateIntToString,
  convertDBProgressToStoreFormat,
} from "@/utils/athkar";
import { createDebouncedQueue } from "@/utils/debounce";

type AthkarStore = AthkarState & AthkarActions;

const debouncedDBUpdate = createDebouncedQueue(
  async (dateInt: number, referenceId: string, count: number, completed: boolean) => {
    await AthkarDB.updateSingleAthkarProgress(dateInt, referenceId, count, completed);
  },
  300 // 300ms delay
);

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
        shortVersion: false,

        // Initialize DB and load data
        initializeStore: async () => {
          try {
            await AthkarDB.initialize();

            // Load streak data from DB
            const streakData = await AthkarDB.getStreakData();
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

            // Load today's progress from DB
            await get().loadTodayProgress();

            // Clean up old data
            await get().cleanUpOldData();
          } catch (error) {
            console.error("Error initializing store:", error);
          }
        },

        // Load today's progress from DB
        loadTodayProgress: async () => {
          const timezone = locationStore.getState().locationDetails.timezone;
          const todayInt = getTodayInt(timezone);
          const dailyProgress = await AthkarDB.getDailyProgress(todayInt);

          if (dailyProgress) {
            try {
              const morningProgress = JSON.parse(dailyProgress.morning_progress);
              const eveningProgress = JSON.parse(dailyProgress.evening_progress);

              const convertedProgress = convertDBProgressToStoreFormat(
                morningProgress,
                eveningProgress,
                timezone
              );

              set({
                currentProgress: convertedProgress,
                todayCompleted: {
                  morning: dailyProgress.morning_completed === 1,
                  evening: dailyProgress.evening_completed === 1,
                },
              });
            } catch (error) {
              console.error("Error parsing progress from DB:", error);
              // Start with empty progress if parsing fails
              set({
                currentProgress: [],
                todayCompleted: { morning: false, evening: false },
              });
            }
          } else {
            // No progress for today, start fresh
            set({
              currentProgress: [],
              todayCompleted: { morning: false, evening: false },
            });
          }
        },

        reloadStreakFromDB: async () => {
          const streakData = await AthkarDB.getStreakData();
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

        moveToPrevious: () =>
          set((state) => ({
            currentAthkarIndex: clampIndex(state.currentAthkarIndex - 1, Infinity),
          })),

        incrementCount: (athkarId) => {
          const state = get();
          const baseId = extractBaseId(athkarId);
          const referenceId = generateReferenceId(baseId, state.currentType);
          const filteredList = filterAthkarByType(state.athkarList, state.currentType);

          const athkar = filteredList.find(
            (a) => `${a.order}-${state.currentType}` === referenceId
          );

          if (!athkar) return;

          const timezone = locationStore.getState().locationDetails.timezone;

          set((state) => {
            const updatedProgress = state.currentProgress.map((p) => {
              if (p.athkarId === referenceId) {
                const newCount = Math.min(p.currentCount + 1, athkar.count);
                return {
                  ...p,
                  currentCount: newCount,
                  completed: isAthkarCompleted(newCount, athkar.count),
                  lastUpdated: getTimestampForTimezone(timezone),
                };
              }
              return p;
            });

            return { currentProgress: updatedProgress };
          });

          // Get the updated progress item
          const updatedState = get();
          const progressItem = updatedState.currentProgress.find((p) => p.athkarId === referenceId);

          if (progressItem) {
            // Queue DB update
            const todayInt = getTodayInt(timezone);
            debouncedDBUpdate.add(
              referenceId,
              todayInt,
              referenceId,
              progressItem.currentCount,
              progressItem.completed
            );
          }

          // Handle auto-move in focus mode
          if (state.focusMode && progressItem?.completed && state.settings.autoMoveToNext) {
            requestAnimationFrame(() => get().moveToNext());
          }

          // Check daily completion status
          requestAnimationFrame(() => get().checkAndUpdateDailyProgress());
        },

        decrementCount: (athkarId) => {
          const state = get();

          const timezone = locationStore.getState().locationDetails.timezone;

          set((state) => {
            const updatedProgress = state.currentProgress.map((p) => {
              if (p.athkarId === athkarId) {
                return {
                  ...p,
                  currentCount: Math.max(p.currentCount - 1, 0),
                  completed: false,
                  lastUpdated: getTimestampForTimezone(timezone),
                };
              }
              return p;
            });

            return { currentProgress: updatedProgress };
          });

          // Get the updated progress item
          const updatedState = get();
          const progressItem = updatedState.currentProgress.find((p) => p.athkarId === athkarId);

          if (progressItem) {
            // Queue DB update
            const todayInt = getTodayInt(timezone);
            debouncedDBUpdate.add(
              athkarId,
              todayInt,
              athkarId,
              progressItem.currentCount,
              progressItem.completed
            );
          }
        },

        // Initialize session - load from DB or create new
        initializeSession: async (type) => {
          const timezone =
            locationStore.getState().locationDetails?.timezone ||
            Intl.DateTimeFormat().resolvedOptions().timeZone;

          const todayInt = getTodayInt(timezone);
          const dailyProgress = await AthkarDB.getDailyProgress(todayInt);

          const filteredAthkar = filterAthkarByType(get().athkarList, type);
          let finalProgress = get().currentProgress;

          if (dailyProgress) {
            // We already have progress loaded
            const existingTypeProgress = filterProgressByType(finalProgress, type);

            if (existingTypeProgress.length === 0) {
              // No progress for this type yet, create it
              const newSessionProgress = filteredAthkar.map((athkar: Athkar) =>
                createProgressItem(athkar, type)
              );

              // Initialize in DB for this session
              const sessionProgress: Record<string, { count: number; completed: boolean }> = {};
              newSessionProgress.forEach((item) => {
                sessionProgress[item.athkarId] = {
                  count: 0,
                  completed: false,
                };
              });

              if (type === ATHKAR_TYPE.MORNING) {
                await AthkarDB.updateMorningProgress(todayInt, sessionProgress, false);
              } else {
                await AthkarDB.updateEveningProgress(todayInt, sessionProgress, false);
              }

              finalProgress = [...finalProgress, ...newSessionProgress];
            }
          } else {
            // No daily progress at all, create new
            const newSessionProgress = filteredAthkar.map((athkar: Athkar) =>
              createProgressItem(athkar, type)
            );

            const sessionProgress: Record<string, { count: number; completed: boolean }> = {};
            newSessionProgress.forEach((item) => {
              sessionProgress[item.athkarId] = {
                count: 0,
                completed: false,
              };
            });

            if (type === ATHKAR_TYPE.MORNING) {
              await AthkarDB.updateMorningProgress(todayInt, sessionProgress, false);
            } else {
              await AthkarDB.updateEveningProgress(todayInt, sessionProgress, false);
            }

            finalProgress = newSessionProgress;
          }

          set({
            currentType: type,
            currentProgress: finalProgress,
            currentAthkarIndex: 0,
            focusMode: false,
          });
        },

        checkAndUpdateDailyProgress: async () => {
          const state = get();

          const morningCompleted = isSessionComplete(state.currentProgress, ATHKAR_TYPE.MORNING);
          const eveningCompleted = isSessionComplete(state.currentProgress, ATHKAR_TYPE.EVENING);

          const newTodayCompleted = {
            morning: morningCompleted,
            evening: eveningCompleted,
          };

          set({ todayCompleted: newTodayCompleted });

          // If both sessions completed, update streak
          if (morningCompleted && eveningCompleted) {
            const timezone =
              locationStore.getState().locationDetails?.timezone ||
              Intl.DateTimeFormat().resolvedOptions().timeZone;
            const todayInt = getTodayInt(timezone);

            await AthkarDB.checkAndUpdateStreakForDate(todayInt);
            await get().reloadStreakFromDB();
          }
        },

        // Streak Management
        updateStreak: async () => {
          const timezone =
            locationStore.getState().locationDetails?.timezone ||
            Intl.DateTimeFormat().resolvedOptions().timeZone;
          const todayInt = getTodayInt(timezone);

          await AthkarDB.checkAndUpdateStreakForDate(todayInt);
          await get().reloadStreakFromDB();
        },

        pauseStreak: async () => {
          await AthkarDB.updateStreakSettings({ isPaused: true });
          await get().reloadStreakFromDB();
        },

        resumeStreak: async () => {
          await AthkarDB.updateStreakSettings({ isPaused: false });
          await get().reloadStreakFromDB();
        },

        updateToleranceDays: async (days: number) => {
          await AthkarDB.updateStreakSettings({ toleranceDays: days });
          await get().reloadStreakFromDB();
        },

        // Reset progress for current session
        resetProgress: async () => {
          const timezone = locationStore.getState().locationDetails.timezone;
          const todayInt = getTodayInt(timezone);
          const type = get().currentType;

          // Reset in memory
          set((state) => ({
            currentProgress: state.currentProgress.map((p) => ({
              ...p,
              currentCount: 0,
              completed: false,
              lastUpdated: getTimestampForTimezone(timezone),
            })),
          }));

          // Reset in DB
          const emptyProgress: Record<string, { count: number; completed: boolean }> = {};
          get()
            .currentProgress.filter((p) => p.athkarId.includes(`-${type}`))
            .forEach((p) => {
              emptyProgress[p.athkarId] = { count: 0, completed: false };
            });

          if (type === ATHKAR_TYPE.MORNING) {
            await AthkarDB.updateMorningProgress(todayInt, emptyProgress, false);
          } else {
            await AthkarDB.updateEveningProgress(todayInt, emptyProgress, false);
          }

          // Update completion status
          set((state) => ({
            todayCompleted: {
              ...state.todayCompleted,
              [type === ATHKAR_TYPE.MORNING ? "morning" : "evening"]: false,
            },
          }));
        },

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

        toggleShortVersion: () => set((state) => ({ shortVersion: !state.shortVersion })),

        // Force recalculation from history (for recovery/debugging)
        forceRecalculateStreak: async () => {
          await AthkarDB.forceUpdateStreakFromHistory();
          await get().reloadStreakFromDB();
        },

        cleanUpOldData: async () => {
          await debouncedDBUpdate.flush();
          await AthkarDB.cleanOldCompletedDays();
          await AthkarDB.cleanOldProgress(7); // Keep only last 7 days of progress
        },
      }),
      {
        name: "athkar-storage",
        storage: createJSONStorage(() => Storage),
        partialize: (state) => ({
          athkarList: state.athkarList,
          todayCompleted: state.todayCompleted,
          settings: state.settings,
          shortVersion: state.shortVersion,
        }),
        onRehydrateStorage: () => (state) => {
          // Initialize DB and load data after rehydration
          state?.initializeStore();
        },
      }
    )
  )
);
