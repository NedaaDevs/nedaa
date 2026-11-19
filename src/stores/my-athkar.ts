import { create } from "zustand";
import { devtools } from "zustand/middleware";

// Services
import { AthkarDB } from "@/services/athkar-db";
import { HisnMuslimDB } from "@/services/hisn-muslim-db";

// Stores
import locationStore from "@/stores/location";

// Utils
import { getTodayInt } from "@/utils/athkar";
import { AppLogger } from "@/utils/appLogger";
import { createDebouncedQueue } from "@/utils/debounce";
import { COUNT_WRITE_DELAY_MS } from "@/constants/AthkarSession";

// Types
import type {
  MyAthkarItem,
  MyAthkarProgress,
  MyAthkarCategoryGroup,
  HisnAthkar,
} from "@/types/hisnMuslim";

type DisplayEntry = HisnAthkar & {
  categoryTitleAr: string;
  categoryTitleEn: string;
};

type MyAthkarState = {
  items: MyAthkarItem[];
  displayData: Map<number, DisplayEntry>;
  progress: MyAthkarProgress[];
  /** The day the counts in memory belong to; null before the first load. */
  progressDay: number | null;
  isInitialized: boolean;
  /** The last read failed, so what is in memory may be missing or out of date. */
  loadFailed: boolean;
};

type MyAthkarActions = {
  /** Loads everything once, or again after a failed read; a failure sets loadFailed. */
  initialize: () => Promise<void>;
  loadItems: () => Promise<void>;
  loadDisplayData: () => Promise<void>;
  initializeDailyProgress: () => Promise<void>;
  loadDailyProgress: () => Promise<void>;
  /** The counts in memory belong to a day that has ended. */
  isAnotherDay: () => boolean;
  /**
   * Loads the new day's counts when the ones in memory are another day's;
   * a failed load drops them and sets loadFailed.
   */
  syncDay: () => Promise<void>;
  /** Writes the counts still waiting for taps to settle. */
  flushCounts: () => Promise<void>;
  /** Whether the row was written; a failed reload after it sets loadFailed. */
  addItem: (
    sourceAthkarId: number,
    sourceCategoryId: number,
    repeatCount: number
  ) => Promise<boolean>;
  /** Whether rows were written; a failed reload after them sets loadFailed. */
  batchAddItems: (
    items: { sourceAthkarId: number; sourceCategoryId: number; repeatCount: number }[]
  ) => Promise<boolean>;
  /** Whether the row was removed; a failed reload after it sets loadFailed. */
  removeItem: (id: number) => Promise<boolean>;
  updateUserCount: (id: number, userCount: number) => Promise<void>;
  getGroupedByCategory: () => MyAthkarCategoryGroup[];
  incrementCount: (myAthkarId: number) => void;
  incrementCountBy: (myAthkarId: number, by: number) => void;
  decrementCount: (myAthkarId: number) => void;
  resetDaily: () => Promise<void>;
  isSourceAdded: (sourceAthkarId: number) => boolean;
  getItemBySourceId: (sourceAthkarId: number) => MyAthkarItem | null;
};

type MyAthkarStore = MyAthkarState & MyAthkarActions;

const log = AppLogger.create("athkar");

const debouncedDailyUpdate = createDebouncedQueue(
  async (dateInt: number, myAthkarId: number, currentCount: number) => {
    await AthkarDB.updateMyAthkarDailyCount(dateInt, myAthkarId, currentCount);
  },
  COUNT_WRITE_DELAY_MS
);

const today = () => getTodayInt(locationStore.getState().locationDetails.timezone);

const asError = (error: unknown) => (error instanceof Error ? error : new Error(String(error)));

/** Writes the day's missing rows; throws when they are not written, so the load reports it. */
const writeDailyRows = async (day: number, items: readonly MyAthkarItem[]) => {
  const written = await AthkarDB.initializeMyAthkarDaily(
    day,
    items.map((i) => ({ id: i.id, userCount: i.userCount }))
  );
  if (!written) throw new Error("My Athkar daily rows were not written");
};

// Reloads begun so far; a day load that began before the latest is older than it.
let reloads = 0;

/** Reads everything again after a write; a failed read leaves the store not loaded. */
const reloadAfterWrite = async () => {
  reloads += 1;
  const store = useMyAthkarStore.getState();
  try {
    await store.loadItems();
    await store.loadDisplayData();
    await store.initializeDailyProgress();
    await store.loadDailyProgress();
    useMyAthkarStore.setState({ loadFailed: false, isInitialized: true });
  } catch (error) {
    log.e("Store", "My Athkar did not reload", asError(error));
    // Memory may hold part of the reload.
    useMyAthkarStore.setState({ loadFailed: true, isInitialized: false });
  }
};

// One load of the new day serves every caller that arrives while it runs.
let dayLoad: Promise<void> | null = null;

/** Queues a count write under the day the counts in memory belong to. */
const queueCountWrite = (progressDay: number | null, id: number, count: number) => {
  const day = progressDay ?? today();
  // Keyed by day too: a count replaces only its own day's.
  debouncedDailyUpdate.add(`${day}:${id}`, day, id, count);
};

/** Groups saved athkar by their source category. Pure, so callers can memoize it. */
export const groupMyAthkarByCategory = (
  items: MyAthkarItem[],
  displayData: Map<number, DisplayEntry>
): MyAthkarCategoryGroup[] => {
  const groupMap = new Map<number, MyAthkarCategoryGroup>();

  for (const item of items) {
    const display = displayData.get(item.sourceAthkarId);
    if (!display) continue;

    let group = groupMap.get(item.sourceCategoryId);
    if (!group) {
      group = {
        categoryId: item.sourceCategoryId,
        titleAr: display.categoryTitleAr,
        titleEn: display.categoryTitleEn,
        items: [],
      };
      groupMap.set(item.sourceCategoryId, group);
    }
    group.items.push(item);
  }

  return Array.from(groupMap.values());
};

export const useMyAthkarStore = create<MyAthkarStore>()(
  devtools(
    (set, get) => ({
      items: [],
      displayData: new Map(),
      progress: [],
      progressDay: null,
      isInitialized: false,
      loadFailed: false,

      initialize: async () => {
        if (get().isInitialized && !get().loadFailed) return;
        set({ loadFailed: false });
        try {
          // Fetch all data first, then set state once to avoid multiple re-renders
          const rows = await AthkarDB.getMyAthkar();
          const items: MyAthkarItem[] = rows.map((r) => ({
            id: r.id,
            sourceAthkarId: r.source_athkar_id,
            sourceCategoryId: r.source_category_id,
            userCount: r.user_count,
            sortOrder: r.sort_order,
          }));

          // Load display data
          let displayData = new Map<number, DisplayEntry>();
          if (items.length > 0) {
            const sourceIds = items.map((i) => i.sourceAthkarId);
            const [athkarRows, categoryMap] = await Promise.all([
              HisnMuslimDB.getAthkarByIds(sourceIds),
              HisnMuslimDB.getCategoryForAthkar(sourceIds),
            ]);

            for (const a of athkarRows) {
              const cat = categoryMap.get(a.id);
              displayData.set(a.id, {
                ...a,
                categoryTitleAr: cat?.titleAr ?? "",
                categoryTitleEn: cat?.titleEn ?? "",
              });
            }

            // Initialize daily progress in DB
            const tz = locationStore.getState().locationDetails.timezone;
            const todayInt = getTodayInt(tz);
            await writeDailyRows(todayInt, items);
          }

          // Load daily progress
          const tz = locationStore.getState().locationDetails.timezone;
          const todayInt = getTodayInt(tz);
          const progressRows = await AthkarDB.getMyAthkarDailyProgress(todayInt);
          const progress: MyAthkarProgress[] = progressRows.map((r) => ({
            myAthkarId: r.my_athkar_id,
            currentCount: r.current_count,
            totalCount: r.total_count,
            completed: r.current_count >= r.total_count,
          }));

          // Single state update
          set({ items, displayData, progress, progressDay: todayInt, isInitialized: true });
        } catch (error) {
          log.e("Store", "My Athkar did not load", asError(error));
          set({ loadFailed: true });
        }
      },

      loadItems: async () => {
        const rows = await AthkarDB.getMyAthkar();
        const items: MyAthkarItem[] = rows.map((r) => ({
          id: r.id,
          sourceAthkarId: r.source_athkar_id,
          sourceCategoryId: r.source_category_id,
          userCount: r.user_count,
          sortOrder: r.sort_order,
        }));
        set({ items });
      },

      loadDisplayData: async () => {
        const { items } = get();
        if (items.length === 0) {
          set({ displayData: new Map() });
          return;
        }

        const sourceIds = items.map((i) => i.sourceAthkarId);
        const [athkarRows, categoryMap] = await Promise.all([
          HisnMuslimDB.getAthkarByIds(sourceIds),
          HisnMuslimDB.getCategoryForAthkar(sourceIds),
        ]);

        const displayData = new Map<number, DisplayEntry>();

        for (const a of athkarRows) {
          const cat = categoryMap.get(a.id);
          displayData.set(a.id, {
            ...a,
            categoryTitleAr: cat?.titleAr ?? "",
            categoryTitleEn: cat?.titleEn ?? "",
          });
        }

        set({ displayData });
      },

      initializeDailyProgress: async () => {
        const { items } = get();
        if (items.length === 0) return;

        const tz = locationStore.getState().locationDetails.timezone;
        const todayInt = getTodayInt(tz);

        await writeDailyRows(todayInt, items);
      },

      loadDailyProgress: async () => {
        const tz = locationStore.getState().locationDetails.timezone;
        const todayInt = getTodayInt(tz);

        const rows = await AthkarDB.getMyAthkarDailyProgress(todayInt);
        const progress: MyAthkarProgress[] = rows.map((r) => ({
          myAthkarId: r.my_athkar_id,
          currentCount: r.current_count,
          totalCount: r.total_count,
          completed: r.current_count >= r.total_count,
        }));

        set({ progress, progressDay: todayInt });
      },

      isAnotherDay: () => {
        const { progressDay } = get();
        return progressDay !== null && progressDay !== today();
      },

      syncDay: async () => {
        if (!get().isAnotherDay()) return;
        const began = reloads;
        dayLoad ??= (async () => {
          await debouncedDailyUpdate.flush();
          await get().initializeDailyProgress();
          await get().loadDailyProgress();
        })()
          .catch((error: unknown) => {
            log.e("Store", "the new day did not load", asError(error));
            // A reload after a write holds today's rows.
            if (reloads !== began) return;
            // The old day's counts are not today's; a full load brings today's.
            set({ progress: [], progressDay: null, isInitialized: false, loadFailed: true });
          })
          .finally(() => {
            dayLoad = null;
          });
        await dayLoad;
      },

      flushCounts: () => debouncedDailyUpdate.flush(),

      addItem: async (sourceAthkarId, sourceCategoryId, repeatCount) => {
        const newId = await AthkarDB.addToMyAthkar(sourceAthkarId, sourceCategoryId, repeatCount);
        if (newId === null) return false;
        await reloadAfterWrite();
        return true;
      },

      batchAddItems: async (items) => {
        const ids = await AthkarDB.batchAddToMyAthkar(
          items.map((i) => ({
            sourceAthkarId: i.sourceAthkarId,
            sourceCategoryId: i.sourceCategoryId,
            userCount: i.repeatCount,
          }))
        );
        if (ids.length === 0) return false;
        await reloadAfterWrite();
        return true;
      },

      removeItem: async (id) => {
        const removed = await AthkarDB.removeFromMyAthkar(id);
        if (!removed) return false;
        // Gone from memory at once, so a failed reload cannot list it.
        set((state) => ({
          items: state.items.filter((i) => i.id !== id),
          progress: state.progress.filter((p) => p.myAthkarId !== id),
        }));
        await reloadAfterWrite();
        return true;
      },

      updateUserCount: async (id, userCount) => {
        await AthkarDB.updateMyAthkarUserCount(id, userCount);
        await get().loadItems();
      },

      getGroupedByCategory: () => {
        const { items, displayData } = get();
        return groupMyAthkarByCategory(items, displayData);
      },

      incrementCount: (myAthkarId) => {
        const { progress } = get();
        const item = progress.find((p) => p.myAthkarId === myAthkarId);
        if (!item || item.completed) return;

        const newCount = Math.min(item.currentCount + 1, item.totalCount);

        set((state) => ({
          progress: state.progress.map((p) =>
            p.myAthkarId === myAthkarId
              ? {
                  ...p,
                  currentCount: newCount,
                  completed: newCount >= p.totalCount,
                }
              : p
          ),
        }));

        queueCountWrite(get().progressDay, myAthkarId, newCount);
      },

      incrementCountBy: (myAthkarId, by) => {
        const { progress } = get();
        const item = progress.find((p) => p.myAthkarId === myAthkarId);
        if (!item || item.completed || by <= 0) return;

        const newCount = Math.min(item.currentCount + by, item.totalCount);

        set((state) => ({
          progress: state.progress.map((p) =>
            p.myAthkarId === myAthkarId
              ? { ...p, currentCount: newCount, completed: newCount >= p.totalCount }
              : p
          ),
        }));

        queueCountWrite(get().progressDay, myAthkarId, newCount);
      },

      decrementCount: (myAthkarId) => {
        const { progress } = get();
        const item = progress.find((p) => p.myAthkarId === myAthkarId);
        if (!item || item.currentCount <= 0) return;

        const newCount = item.currentCount - 1;

        set((state) => ({
          progress: state.progress.map((p) =>
            p.myAthkarId === myAthkarId ? { ...p, currentCount: newCount, completed: false } : p
          ),
        }));

        queueCountWrite(get().progressDay, myAthkarId, newCount);
      },

      resetDaily: async () => {
        const tz = locationStore.getState().locationDetails.timezone;
        const todayInt = getTodayInt(tz);
        await AthkarDB.resetMyAthkarDaily(todayInt);
        await get().loadDailyProgress();
      },

      isSourceAdded: (sourceAthkarId) => {
        return get().items.some((i) => i.sourceAthkarId === sourceAthkarId);
      },

      getItemBySourceId: (sourceAthkarId) => {
        return get().items.find((i) => i.sourceAthkarId === sourceAthkarId) ?? null;
      },
    }),
    { name: "my-athkar-store" }
  )
);
