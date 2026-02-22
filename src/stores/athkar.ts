import { create } from "zustand";
import { persist, createJSONStorage, devtools } from "zustand/middleware";
import Storage from "expo-sqlite/kv-store";

// Types
import { Athkar, AthkarActions, AthkarState, AthkarType } from "@/types/athkar";

// Constants
import { ATHKAR_TYPE } from "@/constants/Athkar";

// Services
import { AthkarDB } from "@/services/athkar-db";

// Stores
import locationStore from "@/stores/location";

// Utils
import { dateIntToString, getTodayInt } from "@/utils/athkar";
import { createDebouncedQueue } from "@/utils/debounce";

type AthkarStore = AthkarState & AthkarActions;

// Debounced DB update queue - keeps existing pattern for DB lock prevention
const debouncedDBUpdate = createDebouncedQueue(
  async (dateInt: number, thikrId: string, count: number) => {
    await AthkarDB.updateAthkarCount(dateInt, thikrId, count);
  },
  300 // 300ms delay
);

// Debounced session completion check
const debouncedSessionCheck = createDebouncedQueue(
  async (dateInt: number, session: "morning" | "evening") => {
    await AthkarDB.checkAndMarkSessionComplete(dateInt, session);
  },
  500 // 500ms delay
);

// Debounced streak update
const debouncedStreakUpdate = createDebouncedQueue(
  async (dateInt: number) => {
    await AthkarDB.updateStreakForDay(dateInt);
  },
  1000 // 1s delay
);

// Debounced cleanup operations
const debouncedCleanup = createDebouncedQueue(
  async (daysToKeep: number) => {
    await AthkarDB.cleanOldData(daysToKeep);
  },
  2000 // 2s delay
);

// Debounced total count updates (for shortVersion changes)
const debouncedTotalCountUpdate = createDebouncedQueue(
  async (
    dateInt: number,
    morningList: { order: number; count: number }[],
    eveningList: { order: number; count: number }[]
  ) => {
    await AthkarDB.updateTotalCounts(dateInt, morningList, eveningList);
  },
  800 // 800ms delay
);

// Debounced session reset
const debouncedSessionReset = createDebouncedQueue(
  async (dateInt: number, session: "morning" | "evening") => {
    await AthkarDB.resetSessionCounts(dateInt, session);
  },
  300 // 300ms delay
);

export const useAthkarStore = create<AthkarStore>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial State
        morningAthkarList: [],
        eveningAthkarList: [],
        currentProgress: [],
        streak: {
          currentStreak: 0,
          longestStreak: 0,
          lastCompletedDate: null,
          isPaused: false,
          toleranceDays: 0,
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
          showTranslation: true,
        },
        shortVersion: false,
        lastMorningIndex: 0,
        lastEveningIndex: 0,

        // Initialize DB and load data
        initializeStore: async () => {
          try {
            await AthkarDB.initialize();

            // Validate streak for missed days (real-time check)
            const tz = locationStore.getState().locationDetails.timezone;
            const todayInt = getTodayInt(tz);
            await AthkarDB.validateStreakForToday(todayInt);

            // Load streak data from DB (now up-to-date after validation)
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

            // Auto-initialize today's data and load progress
            await get().initializeTodayData();

            // Clean up old data
            await get().cleanUpOldData();
          } catch (error) {
            console.error("Error initializing store:", error);
          }
        },

        // Auto-initialize today's data if needed
        initializeTodayData: async () => {
          const tz = locationStore.getState().locationDetails.timezone;
          const todayInt = getTodayInt(tz);
          const state = get();

          // Process morning and evening lists separately
          const morningList = state.morningAthkarList.map((a) => ({
            id: a.id,
            order: a.order,
            count: a.count,
            type: a.type,
          }));

          const eveningList = state.eveningAthkarList.map((a) => ({
            id: a.id,
            order: a.order,
            count: a.count,
            type: a.type,
          }));

          if (morningList.length > 0 || eveningList.length > 0) {
            // Initialize daily items in DB (will only run once per day)
            await AthkarDB.initializeDailyItems(todayInt, morningList, eveningList);
          }

          // Load today's progress
          await get().loadTodayProgress();
        },
        // Update athkar lists and sync DB total counts
        updateAthkarLists: async (morningList: Athkar[], eveningList: Athkar[]) => {
          const tz = locationStore.getState().locationDetails.timezone;
          const todayInt = getTodayInt(tz);

          // Update store state immediately
          set({
            morningAthkarList: morningList,
            eveningAthkarList: eveningList,
          });

          // Create separate lists for DB update
          const morningDbList = morningList.map((a) => ({ order: a.order, count: a.count }));
          const eveningDbList = eveningList.map((a) => ({ order: a.order, count: a.count }));

          if (morningDbList.length > 0 || eveningDbList.length > 0) {
            // Debounce the DB update
            debouncedTotalCountUpdate.add(`${todayInt}`, todayInt, morningDbList, eveningDbList);

            // After total counts are updated, check both sessions for completion
            setTimeout(() => {
              debouncedSessionCheck.add(`${todayInt}-morning-update`, todayInt, "morning");
              debouncedSessionCheck.add(`${todayInt}-evening-update`, todayInt, "evening");
            }, 1000); // Wait for total count update to complete

            // Reload progress after all updates
            setTimeout(async () => {
              await get().loadTodayProgress();
            }, 1500); // Wait for all DB operations to complete
          }
        },

        // Load today's progress from DB
        loadTodayProgress: async () => {
          const tz = locationStore.getState().locationDetails.timezone;
          const todayInt = getTodayInt(tz);

          try {
            // Get morning and evening items from DB
            const morningItems = await AthkarDB.getSessionItems(todayInt, "morning");
            const eveningItems = await AthkarDB.getSessionItems(todayInt, "evening");

            // Convert DB items to store format
            const currentProgress = [
              ...morningItems.map((item) => ({
                athkarId: item.thikr_id,
                currentCount: item.current_count,
                totalCount: item.total_count,
                completed: item.current_count >= item.total_count,
              })),
              ...eveningItems.map((item) => ({
                athkarId: item.thikr_id,
                currentCount: item.current_count,
                totalCount: item.total_count,
                completed: item.current_count >= item.total_count,
              })),
            ];

            // Check completion status
            const morningCompleted = await AthkarDB.isSessionCompleted(todayInt, "morning");
            const eveningCompleted = await AthkarDB.isSessionCompleted(todayInt, "evening");

            set({
              currentProgress,
              todayCompleted: {
                morning: morningCompleted,
                evening: eveningCompleted,
              },
            });
          } catch (error) {
            console.error("Error loading today's progress:", error);
            // Start with empty progress if loading fails
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

        // Check and validate streak daily (called when app becomes active)
        validateDailyStreak: async () => {
          try {
            const tz = locationStore.getState().locationDetails.timezone;
            const todayInt = getTodayInt(tz);

            const validationResult = await AthkarDB.validateStreakForToday(todayInt);

            if (validationResult?.success) {
              // Update streak state immediately if it was changed
              set((state) => ({
                streak: {
                  ...state.streak,
                  currentStreak: validationResult.currentStreak,
                  longestStreak: validationResult.longestStreak,
                },
              }));

              // If streak was broken, also reload today's progress
              if (validationResult.streakBroken) {
                console.log("[Athkar Store] Streak was broken due to missed days");
                await get().initializeTodayData();
              }
            }
          } catch (error) {
            console.error("Error validating daily streak:", error);
          }
        },

        setMorningAthkarList: (list) => set({ morningAthkarList: list }),
        setEveningAthkarList: (list) => set({ eveningAthkarList: list }),
        setCurrentType: (type) => set({ currentType: type }),
        setCurrentAthkarIndex: (index: number) => set({ currentAthkarIndex: index }),
        toggleFocusMode: () => set((state) => ({ focusMode: !state.focusMode })),

        // Find the optimal starting index for focus mode
        findOptimalAthkarIndex: (type: Exclude<AthkarType, "all">) => {
          const state = get();
          const currentList =
            type === ATHKAR_TYPE.MORNING ? state.morningAthkarList : state.eveningAthkarList;

          if (currentList.length === 0) return 0;

          // Get the last known index for this session type
          const lastKnownIndex =
            type === ATHKAR_TYPE.MORNING ? state.lastMorningIndex : state.lastEveningIndex;

          // Ensure the last known index is within bounds
          const safeLastIndex = Math.min(Math.max(lastKnownIndex, 0), currentList.length - 1);

          // Starting from last position, wrap around to find first incomplete
          for (let offset = 0; offset < currentList.length; offset++) {
            const i = (safeLastIndex + offset) % currentList.length;
            if (!state.currentProgress.find((p) => p.athkarId === currentList[i].id)?.completed) {
              return i;
            }
          }

          // All completed — stay at last position
          return safeLastIndex;
        },

        // Update last index for the current session type
        updateLastIndex: (type: Exclude<AthkarType, "all">, index: number) => {
          if (type === ATHKAR_TYPE.MORNING) {
            set({ lastMorningIndex: index });
          } else {
            set({ lastEveningIndex: index });
          }
        },

        // Get last index for a specific session type
        getLastIndex: (type: Exclude<AthkarType, "all">) => {
          const state = get();
          return type === ATHKAR_TYPE.MORNING ? state.lastMorningIndex : state.lastEveningIndex;
        },

        moveToNext: () =>
          set((state) => {
            const currentList =
              state.currentType === ATHKAR_TYPE.MORNING
                ? state.morningAthkarList
                : state.eveningAthkarList;

            const newIndex =
              state.currentAthkarIndex + 1 >= currentList.length
                ? 0 // Here we go again
                : state.currentAthkarIndex + 1;

            // Update both current index and session-specific last index
            const updates: Partial<AthkarState> = { currentAthkarIndex: newIndex };

            if (state.currentType === ATHKAR_TYPE.MORNING) {
              updates.lastMorningIndex = newIndex;
            } else {
              updates.lastEveningIndex = newIndex;
            }

            return updates;
          }),

        moveToPrevious: () =>
          set((state) => {
            const currentList =
              state.currentType === ATHKAR_TYPE.MORNING
                ? state.morningAthkarList
                : state.eveningAthkarList;

            const newIndex =
              state.currentAthkarIndex - 1 < 0
                ? currentList.length - 1 // Wrap around to end
                : state.currentAthkarIndex - 1;

            // Update both current index and session-specific last index
            const updates: Partial<AthkarState> = { currentAthkarIndex: newIndex };

            if (state.currentType === ATHKAR_TYPE.MORNING) {
              updates.lastMorningIndex = newIndex;
            } else {
              updates.lastEveningIndex = newIndex;
            }

            return updates;
          }),

        incrementCount: (athkarId, skipAutoMove) => {
          const state = get();
          const progressItem = state.currentProgress.find((p) => p.athkarId === athkarId);

          if (!progressItem) return;

          const tz = locationStore.getState().locationDetails.timezone;
          const todayInt = getTodayInt(tz);

          // Update in memory
          set((state) => {
            const updatedProgress = state.currentProgress.map((p) => {
              if (p.athkarId === athkarId) {
                const newCount = Math.min(p.currentCount + 1, p.totalCount);
                return {
                  ...p,
                  currentCount: newCount,
                  completed: newCount >= p.totalCount,
                };
              }
              return p;
            });

            return { currentProgress: updatedProgress };
          });

          // Sync lastIndex so focus mode knows where the user was
          const athkarList =
            state.currentType === ATHKAR_TYPE.MORNING
              ? state.morningAthkarList
              : state.eveningAthkarList;
          const tappedIndex = athkarList.findIndex((a) => a.id === athkarId);
          if (tappedIndex !== -1) {
            get().updateLastIndex(state.currentType, tappedIndex);
          }

          // Get the updated progress item
          const updatedState = get();
          const updatedItem = updatedState.currentProgress.find((p) => p.athkarId === athkarId);

          if (updatedItem) {
            // Queue DB update (debounced)
            debouncedDBUpdate.add(athkarId, todayInt, athkarId, updatedItem.currentCount);

            // Handle auto-move in focus mode (skipped when audio player drives navigation)
            if (
              !skipAutoMove &&
              state.focusMode &&
              updatedItem.completed &&
              state.settings.autoMoveToNext
            ) {
              requestAnimationFrame(() => get().moveToNext());
            }

            // Check if session just completed
            if (updatedItem.completed) {
              setTimeout(async () => {
                await get().checkAndUpdateSessionCompletion(athkarId);
              }, 400); // Wait for debounced update
            }
          }
        },

        decrementCount: (athkarId) => {
          const state = get();
          const progressItem = state.currentProgress.find((p) => p.athkarId === athkarId);

          if (!progressItem) return;

          const tz = locationStore.getState().locationDetails.timezone;
          const todayInt = getTodayInt(tz);

          // Update in memory
          set((state) => {
            const updatedProgress = state.currentProgress.map((p) => {
              if (p.athkarId === athkarId) {
                const newCount = Math.max(p.currentCount - 1, 0);
                return {
                  ...p,
                  currentCount: newCount,
                  completed: newCount >= p.totalCount,
                };
              }
              return p;
            });

            return { currentProgress: updatedProgress };
          });

          // Get the updated progress item
          const updatedState = get();
          const updatedItem = updatedState.currentProgress.find((p) => p.athkarId === athkarId);

          if (updatedItem) {
            // Queue DB update (debounced)
            debouncedDBUpdate.add(athkarId, todayInt, athkarId, updatedItem.currentCount);
          }
        },

        // Initialize session - switch between morning/evening
        initializeSession: async (type) => {
          await get().initializeTodayData(); // Ensure today is initialized
          const optimalIndex = get().findOptimalAthkarIndex(type);
          set({
            currentType: type,
            currentAthkarIndex: 0,
            focusMode: false,
          });

          get().updateLastIndex(type, optimalIndex);
        },

        // Check and update session completion after item completion
        checkAndUpdateSessionCompletion: async (athkarId: string) => {
          const tz = locationStore.getState().locationDetails.timezone;
          const todayInt = getTodayInt(tz);

          // Determine session from athkar ID
          const session = athkarId.includes("-morning") ? "morning" : "evening";

          // Debounce session completion check
          debouncedSessionCheck.add(`${todayInt}-${session}`, todayInt, session);

          // Set up a callback to check for streak updates after session completion
          setTimeout(async () => {
            const bothCompleted = await AthkarDB.areBothSessionsCompleted(todayInt);
            if (bothCompleted) {
              console.log(
                `[Athkar Store] Both sessions complete for day ${todayInt}, updating streak...`
              );

              // Debounce streak update
              debouncedStreakUpdate.add(`${todayInt}`, todayInt);

              // Reload streak data after a delay
              setTimeout(async () => {
                await get().reloadStreakFromDB();
              }, 1500); // Wait for debounced operations to complete
            }
          }, 1000); // Wait for session completion to process
        },

        // Reset progress for current session
        resetProgress: async () => {
          const tz = locationStore.getState().locationDetails.timezone;
          const todayInt = getTodayInt(tz);
          const type = get().currentType;
          const session = type === ATHKAR_TYPE.MORNING ? ATHKAR_TYPE.MORNING : ATHKAR_TYPE.EVENING;
          const eIndex = get().lastEveningIndex;
          const mIndex = get().lastMorningIndex;
          // Reset in memory immediately for better UX
          set((state) => ({
            lastEveningIndex: type === ATHKAR_TYPE.EVENING ? 0 : eIndex,
            lastMorningIndex: type === ATHKAR_TYPE.EVENING ? 0 : mIndex,
            currentProgress: state.currentProgress.map((p) => {
              if (p.athkarId.includes(`-${type}`)) {
                return {
                  ...p,
                  currentCount: 0,
                  completed: false,
                };
              }
              return p;
            }),
            todayCompleted: {
              ...state.todayCompleted,
              [session]: false,
            },
          }));

          // Debounce the DB reset operation
          debouncedSessionReset.add(`${todayInt}-${session}`, todayInt, session);
        },

        // Streak Management
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

        toggleShowTranslation: () =>
          set((state) => ({
            settings: {
              ...state.settings,
              showTranslation: !state.settings.showTranslation,
            },
          })),

        toggleShortVersion: () => set((state) => ({ shortVersion: !state.shortVersion })),

        cleanUpOldData: async () => {
          // Flush all pending DB operations before cleanup
          await debouncedDBUpdate.flush();
          await debouncedSessionCheck.flush();
          await debouncedStreakUpdate.flush();
          await debouncedTotalCountUpdate.flush();
          await debouncedSessionReset.flush();

          // Debounce the cleanup operation
          debouncedCleanup.add("cleanup", 5); // Keep only last 5 days
        },
      }),
      {
        name: "athkar-storage",
        storage: createJSONStorage(() => Storage),
        partialize: (state) => ({
          morningAthkarList: state.morningAthkarList,
          eveningAthkarList: state.eveningAthkarList,
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
