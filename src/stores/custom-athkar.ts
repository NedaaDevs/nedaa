import { create } from "zustand";
import { devtools } from "zustand/middleware";

import { AthkarDB } from "@/services/athkar-db";
import locationStore from "@/stores/location";
import { getTodayInt } from "@/utils/athkar";
import { AppLogger } from "@/utils/appLogger";
import { createDebouncedQueue } from "@/utils/debounce";
import { COUNT_WRITE_DELAY_MS } from "@/constants/AthkarSession";

import type {
  CustomAthkarGroup,
  CustomAthkarItem,
  CustomAthkarProgress,
  CustomAthkarItemDraft,
} from "@/types/athkar";

type CustomAthkarState = {
  groups: CustomAthkarGroup[];
  items: CustomAthkarItem[];
  progress: CustomAthkarProgress[];
  /** The day the counts in memory belong to; null before the first load. */
  progressDay: number | null;
  isInitialized: boolean;
  /** The last read failed, so what is in memory may be missing or out of date. */
  loadFailed: boolean;
};

type CustomAthkarActions = {
  /** Loads everything once, or again after a failed read; a failure sets loadFailed. */
  initialize: () => Promise<void>;
  loadGroups: () => Promise<void>;
  loadItems: () => Promise<void>;
  initializeDailyProgress: () => Promise<void>;
  loadDailyProgress: () => Promise<void>;
  /** The counts in memory belong to a day that has ended. */
  isAnotherDay: () => boolean;
  /** Loads the new day's counts when the ones in memory are another day's; a failed load keeps them. */
  syncDay: () => Promise<void>;
  /** Writes the counts still waiting for taps to settle. */
  flushCounts: () => Promise<void>;
  /** The new group's id once written, or null; a failed reload after it sets loadFailed. */
  createGroup: (title: string, drafts: CustomAthkarItemDraft[]) => Promise<number | null>;
  /** Whether the edit was written; a failed reload after it sets loadFailed. */
  updateGroup: (id: number, title: string, drafts: CustomAthkarItemDraft[]) => Promise<boolean>;
  /** Whether the group was deleted; a failed reload after it sets loadFailed. */
  deleteGroup: (id: number) => Promise<boolean>;
  incrementCount: (customItemId: number) => void;
  incrementCountBy: (customItemId: number, by: number) => void;
  decrementCount: (customItemId: number) => void;
  getGroupItems: (groupId: number) => CustomAthkarItem[];
  getGroupProgress: (groupId: number) => CustomAthkarProgress[];
};

type CustomAthkarStore = CustomAthkarState & CustomAthkarActions;

const log = AppLogger.create("athkar");

const debouncedDailyUpdate = createDebouncedQueue(
  async (dateInt: number, customItemId: number, currentCount: number) => {
    await AthkarDB.updateCustomAthkarDailyCount(dateInt, customItemId, currentCount);
  },
  COUNT_WRITE_DELAY_MS
);

const today = () => getTodayInt(locationStore.getState().locationDetails.timezone);

const asError = (error: unknown) => (error instanceof Error ? error : new Error(String(error)));

/** Reads everything again after a write; a failed read sets loadFailed. */
const reloadAfterWrite = async () => {
  const store = useCustomAthkarStore.getState();
  try {
    await store.loadGroups();
    await store.loadItems();
    await store.initializeDailyProgress();
    await store.loadDailyProgress();
    useCustomAthkarStore.setState({ loadFailed: false, isInitialized: true });
  } catch (error) {
    log.e("Store", "the custom groups did not reload", asError(error));
    useCustomAthkarStore.setState({ loadFailed: true });
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

export const useCustomAthkarStore = create<CustomAthkarStore>()(
  devtools(
    (set, get) => ({
      groups: [],
      items: [],
      progress: [],
      progressDay: null,
      isInitialized: false,
      loadFailed: false,

      initialize: async () => {
        if (get().isInitialized && !get().loadFailed) return;
        set({ loadFailed: false });
        try {
          const [groupRows, itemRows] = await Promise.all([
            AthkarDB.getCustomAthkarGroups(),
            AthkarDB.getCustomAthkarItems(),
          ]);

          const groups: CustomAthkarGroup[] = groupRows.map((r) => ({
            id: r.id,
            title: r.title,
            sortOrder: r.sort_order,
          }));

          const items: CustomAthkarItem[] = itemRows.map((r) => ({
            id: r.id,
            groupId: r.group_id,
            arabicText: r.arabic_text,
            userCount: r.user_count,
            sortOrder: r.sort_order,
          }));

          if (items.length > 0) {
            const tz = locationStore.getState().locationDetails.timezone;
            const todayInt = getTodayInt(tz);
            await AthkarDB.initializeCustomAthkarDaily(
              todayInt,
              items.map((i) => ({ id: i.id, userCount: i.userCount }))
            );
          }

          const tz = locationStore.getState().locationDetails.timezone;
          const todayInt = getTodayInt(tz);
          const progressRows = await AthkarDB.getCustomAthkarDailyProgress(todayInt);
          const progress: CustomAthkarProgress[] = progressRows.map((r) => ({
            customItemId: r.custom_item_id,
            currentCount: r.current_count,
            totalCount: r.total_count,
            completed: r.current_count >= r.total_count,
          }));

          set({ groups, items, progress, progressDay: todayInt, isInitialized: true });
        } catch (error) {
          log.e("Store", "the custom groups did not load", asError(error));
          set({ loadFailed: true });
        }
      },

      loadGroups: async () => {
        const rows = await AthkarDB.getCustomAthkarGroups();
        const groups: CustomAthkarGroup[] = rows.map((r) => ({
          id: r.id,
          title: r.title,
          sortOrder: r.sort_order,
        }));
        set({ groups });
      },

      loadItems: async () => {
        const rows = await AthkarDB.getCustomAthkarItems();
        const items: CustomAthkarItem[] = rows.map((r) => ({
          id: r.id,
          groupId: r.group_id,
          arabicText: r.arabic_text,
          userCount: r.user_count,
          sortOrder: r.sort_order,
        }));
        set({ items });
      },

      initializeDailyProgress: async () => {
        const { items } = get();
        if (items.length === 0) return;
        const tz = locationStore.getState().locationDetails.timezone;
        const todayInt = getTodayInt(tz);
        await AthkarDB.initializeCustomAthkarDaily(
          todayInt,
          items.map((i) => ({ id: i.id, userCount: i.userCount }))
        );
      },

      loadDailyProgress: async () => {
        const tz = locationStore.getState().locationDetails.timezone;
        const todayInt = getTodayInt(tz);
        const rows = await AthkarDB.getCustomAthkarDailyProgress(todayInt);
        const progress: CustomAthkarProgress[] = rows.map((r) => ({
          customItemId: r.custom_item_id,
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
          .catch((error: unknown) => log.e("Store", "the new day did not load", asError(error)))
          .finally(() => {
            dayLoad = null;
          });
        await dayLoad;
      },

      flushCounts: () => debouncedDailyUpdate.flush(),

      createGroup: async (title, drafts) => {
        const groupId = await AthkarDB.createCustomAthkarGroup(title, drafts);
        if (groupId === null) return null;
        await reloadAfterWrite();
        return groupId;
      },

      updateGroup: async (id, title, drafts) => {
        // A waiting count lands first, so the edit caps it.
        await debouncedDailyUpdate.flush();
        const ok = await AthkarDB.updateCustomAthkarGroup(id, title, drafts, today());
        if (!ok) return false;
        await reloadAfterWrite();
        return true;
      },

      deleteGroup: async (id) => {
        const ok = await AthkarDB.deleteCustomAthkarGroup(id);
        if (!ok) return false;
        await reloadAfterWrite();
        return true;
      },

      incrementCount: (customItemId) => {
        const { progress } = get();
        const item = progress.find((p) => p.customItemId === customItemId);
        if (!item || item.completed) return;
        const newCount = Math.min(item.currentCount + 1, item.totalCount);
        set((state) => ({
          progress: state.progress.map((p) =>
            p.customItemId === customItemId
              ? { ...p, currentCount: newCount, completed: newCount >= p.totalCount }
              : p
          ),
        }));
        queueCountWrite(get().progressDay, customItemId, newCount);
      },

      incrementCountBy: (customItemId, by) => {
        const { progress } = get();
        const item = progress.find((p) => p.customItemId === customItemId);
        if (!item || item.completed || by <= 0) return;
        const newCount = Math.min(item.currentCount + by, item.totalCount);
        set((state) => ({
          progress: state.progress.map((p) =>
            p.customItemId === customItemId
              ? { ...p, currentCount: newCount, completed: newCount >= p.totalCount }
              : p
          ),
        }));
        queueCountWrite(get().progressDay, customItemId, newCount);
      },

      decrementCount: (customItemId) => {
        const { progress } = get();
        const item = progress.find((p) => p.customItemId === customItemId);
        if (!item || item.currentCount <= 0) return;
        const newCount = item.currentCount - 1;
        set((state) => ({
          progress: state.progress.map((p) =>
            p.customItemId === customItemId ? { ...p, currentCount: newCount, completed: false } : p
          ),
        }));
        queueCountWrite(get().progressDay, customItemId, newCount);
      },

      getGroupItems: (groupId) => {
        return get().items.filter((i) => i.groupId === groupId);
      },

      getGroupProgress: (groupId) => {
        const groupItemIds = new Set(
          get()
            .items.filter((i) => i.groupId === groupId)
            .map((i) => i.id)
        );
        return get().progress.filter((p) => groupItemIds.has(p.customItemId));
      },
    }),
    { name: "custom-athkar-store" }
  )
);
