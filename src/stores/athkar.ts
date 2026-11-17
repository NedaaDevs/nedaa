import { create } from "zustand";
import { persist, createJSONStorage, devtools } from "zustand/middleware";
import Storage from "expo-sqlite/kv-store";

// Types
import { Athkar, AthkarActions, AthkarState, AthkarType } from "@/types/athkar";
import { PLAYER_STATE } from "@/types/athkar-audio";

// Constants
import { ATHKAR_TYPE } from "@/constants/Athkar";
import { ADVANCE_PAUSE_MS, COUNT_WRITE_DELAY_MS } from "@/constants/AthkarSession";

// Services
import { AthkarDB } from "@/services/athkar-db";

// Stores
import locationStore from "@/stores/location";

// Utils
import { dateIntToString, getTodayInt } from "@/utils/athkar";
import { audioOwnsCount, nextOpenIndex, toCounts, toSessionItems } from "@/utils/athkarSession";
import { createDebouncedQueue } from "@/utils/debounce";
import { AppLogger } from "@/utils/appLogger";

const log = AppLogger.create("athkar");

type AthkarStore = AthkarState & AthkarActions;

// Resolved at call time so the snapshot module's own imports stay off this store's
// import graph. Fire-and-forget — the snapshot must never block a store action.
// require, not import(): a dynamic import throws inside the Jest VM, which has no
// ES-module loader, so the wiring below would be untestable.
const syncWidgetSnapshot = () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const m = require("@/services/widgetSnapshot") as typeof import("@/services/widgetSnapshot");
  void m.syncWidgetSnapshot();
};

// Debounced DB update queue - keeps existing pattern for DB lock prevention
const debouncedDBUpdate = createDebouncedQueue(
  async (dateInt: number, thikrId: string, count: number, target: number) => {
    const written = await AthkarDB.updateAthkarCount(dateInt, thikrId, count, target);
    if (!written) throw new Error(`count of ${thikrId} not written`);
  },
  COUNT_WRITE_DELAY_MS,
  { retainFailed: true }
);

// Moves with every queued count write; a reload reads again when it moved.
let countRevision = 0;

// Debounced session completion check
const debouncedSessionCheck = createDebouncedQueue(
  async (dateInt: number, session: "morning" | "evening") => {
    await AthkarDB.checkAndMarkSessionComplete(dateInt, session);
    syncWidgetSnapshot();
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

type SessionType = Exclude<AthkarType, "all">;

const listOf = (state: AthkarState, type: SessionType) =>
  type === ATHKAR_TYPE.MORNING ? state.morningAthkarList : state.eveningAthkarList;

/** A place in a period's list, kept as that period's last place too. */
const placeAt = (type: SessionType, index: number): Partial<AthkarState> => ({
  currentAthkarIndex: index,
  ...(type === ATHKAR_TYPE.MORNING ? { lastMorningIndex: index } : { lastEveningIndex: index }),
});

// The one pending move to the next dhikr. Every action that changes the place clears it.
let advanceTimer: ReturnType<typeof setTimeout> | null = null;

const clearAdvanceTimer = () => {
  if (advanceTimer === null) return;
  clearTimeout(advanceTimer);
  advanceTimer = null;
};

const today = () => getTodayInt(locationStore.getState().locationDetails.timezone);

/** Queues a count write under the day the counts in memory belong to. */
const queueCountWrite = (state: AthkarState, athkarId: string) => {
  const item = state.currentProgress.find((p) => p.athkarId === athkarId);
  if (!item) return;
  countRevision += 1;
  const day = state.progressDay ?? today();
  // Keyed by day too: a count replaces only its own day's.
  debouncedDBUpdate.add(`${day}:${athkarId}`, day, athkarId, item.currentCount, item.totalCount);
};

type Get = () => AthkarStore;
type Set = (partial: Partial<AthkarState>) => void;

/** Holds the finished dhikr for the pause, then opens the next unfinished one. */
const startAdvance = (get: Get, set: Set, athkarId: string) => {
  const state = get();
  if (!state.settings.autoMoveToNext) return;
  const type = state.currentType;
  const from = listOf(state, type).findIndex((a) => a.id === athkarId);
  if (from === -1) return;

  clearAdvanceTimer();
  set({ advancePending: true });
  advanceTimer = setTimeout(() => {
    advanceTimer = null;
    const now = get();
    const next = nextOpenIndex(
      toSessionItems(listOf(now, type)),
      toCounts(now.currentProgress),
      from
    );
    set({ advancePending: false, ...(next === null ? {} : placeAt(type, next)) });
  }, ADVANCE_PAUSE_MS);
};

// One load of the new day serves every caller that arrives while it runs.
let dayLoad: Promise<void> | null = null;

/**
 * Null when the counts in memory are today's or none are loaded. Otherwise the old
 * day's pending writes land and the new day loads; a failed load leaves no day loaded.
 */
const loadNewDay = (get: Get, set: Set): Promise<void> | null => {
  const { progressDay } = get();
  if (progressDay === null || progressDay === today()) return null;

  dayLoad ??= (async () => {
    clearAdvanceTimer();
    set({ advancePending: false });
    await get().initializeTodayData();
  })()
    .catch((error: unknown) => {
      log.e(
        "Store",
        "the new day did not load",
        error instanceof Error ? error : new Error(String(error))
      );
      set({ currentProgress: [], progressDay: null });
    })
    .finally(() => {
      dayLoad = null;
    });
  return dayLoad;
};

/**
 * True when the counts in memory belong to another day: `count` runs once the new
 * day has loaded, and is dropped when the load fails.
 */
const deferToNewDay = (get: Get, set: Set, count: () => void) => {
  const load = loadNewDay(get, set);
  if (load === null) return false;
  void load.then(() => {
    if (get().progressDay === today()) count();
  });
  return true;
};

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
        currentAthkarIndex: 0,
        advancePending: false,
        progressDay: null,
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
        focusHintSeen: false,
        lastMorningIndex: 0,
        lastEveningIndex: 0,

        // Audio playback state (sole writer: player singleton)
        playerState: "idle",
        loadingAthkarId: null,
        currentAthkarId: null,
        currentThikrId: null,
        repeatProgress: { current: 0, total: 0 },
        sessionProgress: { current: 0, total: 0 },
        groupProgress: null,

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
            log.e(
              "Store",
              "store initialization failed",
              error instanceof Error ? error : undefined
            );
          }
        },

        // Auto-initialize today's data if needed
        initializeTodayData: async () => {
          // Ensure DB tables exist before any queries — prevents race where
          // component effects query before onRehydrateStorage finishes table creation
          await AthkarDB.initialize();

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
          } else {
            log.w("Store", "initializeTodayData: both lists empty — DB rows NOT initialized");
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
            // A count queued during the reads is not in the rows: write and read again.
            let revision, morningItems, eveningItems, morningCompleted, eveningCompleted;
            do {
              revision = countRevision;
              await debouncedDBUpdate.flush();
              morningItems = await AthkarDB.getSessionItems(todayInt, "morning");
              eveningItems = await AthkarDB.getSessionItems(todayInt, "evening");
              morningCompleted = await AthkarDB.isSessionCompleted(todayInt, "morning");
              eveningCompleted = await AthkarDB.isSessionCompleted(todayInt, "evening");
            } while (revision !== countRevision);

            // A count the DB did not take is newer than its row.
            const unwritten = new Map(
              debouncedDBUpdate
                .pending()
                .filter(([date]) => date === todayInt)
                .map(([, id, count]) => [id, count])
            );

            const currentProgress = [...morningItems, ...eveningItems].map((item) => {
              const currentCount = unwritten.get(item.thikr_id) ?? item.current_count;
              return {
                athkarId: item.thikr_id,
                currentCount,
                totalCount: item.total_count,
                completed: currentCount >= item.total_count,
              };
            });

            const completedCount = currentProgress.filter((p) => p.completed).length;
            if (completedCount === currentProgress.length && currentProgress.length > 0) {
              log.w(
                "Store",
                `loadTodayProgress: all ${currentProgress.length} items are completed on load — focus mode will show done screen`
              );
            }

            // Warn on suspicious per-item states
            currentProgress.forEach((p) => {
              if (p.completed && p.currentCount === 0) {
                log.w(
                  "Store",
                  `loadTodayProgress: ${p.athkarId} is completed with count=0 (total=${p.totalCount})`
                );
              }
            });

            // Another day's place means nothing on this one.
            const { progressDay } = get();
            const newDay = progressDay !== null && progressDay !== todayInt;
            set({
              ...(newDay
                ? { currentAthkarIndex: 0, lastMorningIndex: 0, lastEveningIndex: 0 }
                : {}),
              currentProgress,
              progressDay: todayInt,
              todayCompleted: {
                morning: morningCompleted,
                evening: eveningCompleted,
              },
            });
          } catch (error) {
            console.error("Error loading today's progress:", error);
            log.e(
              "Store",
              "loadTodayProgress failed",
              error instanceof Error ? error : new Error(String(error))
            );
            // Start with empty progress if loading fails
            set({
              currentProgress: [],
              progressDay: null,
              todayCompleted: { morning: false, evening: false },
            });
          }
        },

        reloadStreakFromDB: async () => {
          const streakData = await AthkarDB.getStreakData();
          syncWidgetSnapshot();
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
        setCurrentType: (type) => {
          clearAdvanceTimer();
          set({ currentType: type, advancePending: false });
        },
        setCurrentAthkarIndex: (index: number) => {
          clearAdvanceTimer();
          set({ currentAthkarIndex: index, advancePending: false });
        },

        jumpToIndex: (index) => {
          const state = get();
          const inRange =
            Number.isInteger(index) &&
            index >= 0 &&
            index < listOf(state, state.currentType).length;
          if (!inRange) return;
          clearAdvanceTimer();
          set({ ...placeAt(state.currentType, index), advancePending: false });
        },

        // Audio state actions (sole writer: player singleton)
        setPlayerState: (playerState) =>
          set((s) => ({
            playerState,
            // Clear the pending-load marker once we leave the loading state.
            loadingAthkarId: playerState === PLAYER_STATE.LOADING ? s.loadingAthkarId : null,
          })),
        setLoadingAthkarId: (loadingAthkarId) => set({ loadingAthkarId }),
        setCurrentTrack: (thikrId, athkarId) =>
          set({ currentThikrId: thikrId, currentAthkarId: athkarId }),
        setRepeatProgress: (repeatProgress) => set({ repeatProgress }),
        setSessionProgress: (sessionProgress) => set({ sessionProgress }),
        setGroupProgress: (groupProgress) => set({ groupProgress }),

        transitionTrack: (params) => {
          const {
            previousAthkarId,
            newAthkarId,
            newThikrId,
            repeatProgress,
            sessionProgress,
            newIndex,
          } = params;

          set((state) => {
            const updates: Partial<AthkarState> = {
              currentAthkarId: newAthkarId,
              currentThikrId: newThikrId,
              repeatProgress,
              sessionProgress,
              currentAthkarIndex: newIndex,
            };

            if (state.currentType === ATHKAR_TYPE.MORNING) {
              updates.lastMorningIndex = newIndex;
            } else {
              updates.lastEveningIndex = newIndex;
            }

            if (previousAthkarId) {
              updates.currentProgress = state.currentProgress.map((p) => {
                if (p.athkarId === previousAthkarId) {
                  const newCount = Math.min(p.currentCount + 1, p.totalCount);
                  return { ...p, currentCount: newCount, completed: newCount >= p.totalCount };
                }
                return p;
              });
            }

            return updates;
          });

          if (previousAthkarId) {
            const updatedItem = get().currentProgress.find((p) => p.athkarId === previousAthkarId);
            if (updatedItem) {
              queueCountWrite(get(), previousAthkarId);
              if (updatedItem.completed) {
                setTimeout(async () => {
                  await get().checkAndUpdateSessionCompletion(previousAthkarId);
                }, 400);
              }
            }
          }
        },

        resetPlaybackState: () =>
          set({
            playerState: "idle",
            loadingAthkarId: null,
            currentAthkarId: null,
            currentThikrId: null,
            repeatProgress: { current: 0, total: 0 },
            sessionProgress: { current: 0, total: 0 },
            groupProgress: null,
          }),

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

        moveToNext: () => {
          clearAdvanceTimer();
          set((state) => {
            const { length } = listOf(state, state.currentType);
            const index = state.currentAthkarIndex + 1 >= length ? 0 : state.currentAthkarIndex + 1;
            return { ...placeAt(state.currentType, index), advancePending: false };
          });
        },

        moveToPrevious: () => {
          clearAdvanceTimer();
          set((state) => {
            const { length } = listOf(state, state.currentType);
            const index =
              state.currentAthkarIndex - 1 < 0 ? length - 1 : state.currentAthkarIndex - 1;
            return { ...placeAt(state.currentType, index), advancePending: false };
          });
        },

        incrementCount: (athkarId, skipAutoMove) => {
          if (deferToNewDay(get, set, () => get().incrementCount(athkarId, skipAutoMove))) return;
          const state = get();

          // Audio owns this dhikr's count; the player's own counts pass skipAutoMove.
          if (!skipAutoMove && audioOwnsCount(state, athkarId)) return;

          // The finished dhikr is still on screen; a tap now belongs to no dhikr.
          if (!skipAutoMove && state.advancePending) return;

          const progressItem = state.currentProgress.find((p) => p.athkarId === athkarId);

          if (!progressItem) {
            log.w(
              "Store",
              `incrementCount: no progressItem for ${athkarId} — currentProgress has ${state.currentProgress.length} items: [${state.currentProgress.map((p) => p.athkarId).join(", ")}]`
            );
            return;
          }

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
            queueCountWrite(updatedState, athkarId);

            // The audio player moves the place itself.
            if (!skipAutoMove && updatedItem.completed) startAdvance(get, set, athkarId);

            // Check if session just completed
            if (updatedItem.completed) {
              setTimeout(async () => {
                await get().checkAndUpdateSessionCompletion(athkarId);
              }, 400); // Wait for debounced update
            }
          }
        },

        incrementCountBy: (athkarId, by) => {
          if (deferToNewDay(get, set, () => get().incrementCountBy(athkarId, by))) return;
          const state = get();

          // Audio that counts this dhikr closes the hand's count.
          if (audioOwnsCount(state, athkarId)) return;
          if (state.advancePending) return;

          const progressItem = state.currentProgress.find((p) => p.athkarId === athkarId);
          if (!progressItem || progressItem.completed) return;
          if (by <= 0) return;

          // Clamp so we never overshoot the remaining count.
          const newCount = Math.min(progressItem.currentCount + by, progressItem.totalCount);

          set((currentState) => ({
            currentProgress: currentState.currentProgress.map((p) =>
              p.athkarId === athkarId
                ? { ...p, currentCount: newCount, completed: newCount >= p.totalCount }
                : p
            ),
          }));

          // Keep lastIndex in sync so focus mode resumes where the user was.
          const athkarList =
            state.currentType === ATHKAR_TYPE.MORNING
              ? state.morningAthkarList
              : state.eveningAthkarList;
          const tappedIndex = athkarList.findIndex((a) => a.id === athkarId);
          if (tappedIndex !== -1) {
            get().updateLastIndex(state.currentType, tappedIndex);
          }

          queueCountWrite(get(), athkarId);

          // Fire completion side-effects only once if we just finished.
          if (newCount >= progressItem.totalCount) {
            startAdvance(get, set, athkarId);
            setTimeout(async () => {
              await get().checkAndUpdateSessionCompletion(athkarId);
            }, 400);
          }
        },

        decrementCount: (athkarId) => {
          if (deferToNewDay(get, set, () => get().decrementCount(athkarId))) return;
          const state = get();
          const progressItem = state.currentProgress.find((p) => p.athkarId === athkarId);

          if (!progressItem) return;

          clearAdvanceTimer();

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

            return { currentProgress: updatedProgress, advancePending: false };
          });

          // Get the updated progress item
          const updatedState = get();
          const updatedItem = updatedState.currentProgress.find((p) => p.athkarId === athkarId);

          if (updatedItem) queueCountWrite(updatedState, athkarId);
        },

        // Initialize session - switch between morning/evening
        initializeSession: async (type) => {
          await get().initializeTodayData(); // Ensure today is initialized
          const optimalIndex = get().findOptimalAthkarIndex(type);
          clearAdvanceTimer();
          set({
            currentType: type,
            currentAthkarIndex: 0,
            advancePending: false,
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
          clearAdvanceTimer();
          // Reset in memory immediately for better UX
          set((state) => ({
            ...placeAt(session, 0),
            advancePending: false,
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
        markFocusHintSeen: () => set({ focusHintSeen: true }),

        syncDay: async () => {
          await loadNewDay(get, set);
        },

        flushCounts: async () => {
          if (!debouncedDBUpdate.hasPending()) return;
          await debouncedDBUpdate.flush();
          syncWidgetSnapshot();
        },

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
          focusHintSeen: state.focusHintSeen,
        }),
        onRehydrateStorage: () => (state) => {
          // Initialize DB and load data after rehydration
          state?.initializeStore();
        },
      }
    )
  )
);
