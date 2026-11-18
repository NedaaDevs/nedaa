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
};

type MyAthkarActions = {
  initialize: () => Promise<void>;
  loadItems: () => Promise<void>;
  loadDisplayData: () => Promise<void>;
  initializeDailyProgress: () => Promise<void>;
  loadDailyProgress: () => Promise<void>;
  /** The counts in memory belong to a day that has ended. */
  isAnotherDay: () => boolean;
  /** Loads the new day's counts when the ones in memory are another day's; a failed load keeps them. */
  syncDay: () => Promise<void>;
  /** Writes the counts still waiting for taps to settle. */
  flushCounts: () => Promise<void>;
  addItem: (
    sourceAthkarId: number,
    sourceCategoryId: number,
    repeatCount: number
  ) => Promise<boolean>;
  batchAddItems: (
    items: { sourceAthkarId: number; sourceCategoryId: number; repeatCount: number }[]
  ) => Promise<boolean>;
  removeItem: (id: number) => Promise<void>;
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

      initialize: async () => {
        if (get().isInitialized) return;
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
          await AthkarDB.initializeMyAthkarDaily(
            todayInt,
            items.map((i) => ({ id: i.id, userCount: i.userCount }))
          );
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

        await AthkarDB.initializeMyAthkarDaily(
          todayInt,
          items.map((i) => ({ id: i.id, userCount: i.userCount }))
        );
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
        dayLoad ??= (async () => {
          await debouncedDailyUpdate.flush();
          await get().initializeDailyProgress();
          await get().loadDailyProgress();
        })()
          .catch((error: unknown) =>
            log.e(
              "Store",
              "the new day did not load",
              error instanceof Error ? error : new Error(String(error))
            )
          )
          .finally(() => {
            dayLoad = null;
          });
        await dayLoad;
      },

      flushCounts: () => debouncedDailyUpdate.flush(),

      addItem: async (sourceAthkarId, sourceCategoryId, repeatCount) => {
        const newId = await AthkarDB.addToMyAthkar(sourceAthkarId, sourceCategoryId, repeatCount);
        if (newId === null) return false;

        await get().loadItems();
        await get().loadDisplayData();
        await get().initializeDailyProgress();
        await get().loadDailyProgress();
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

        await get().loadItems();
        await get().loadDisplayData();
        await get().initializeDailyProgress();
        await get().loadDailyProgress();
        return true;
      },

      removeItem: async (id) => {
        await AthkarDB.removeFromMyAthkar(id);
        await get().loadItems();
        await get().loadDisplayData();
        await get().loadDailyProgress();
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
