import { create } from "zustand";
import { devtools } from "zustand/middleware";

import { AthkarDB } from "@/services/athkar-db";
import locationStore from "@/stores/location";
import { getTodayInt } from "@/utils/athkar";
import { createDebouncedQueue } from "@/utils/debounce";

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
  isInitialized: boolean;
};

type CustomAthkarActions = {
  initialize: () => Promise<void>;
  loadGroups: () => Promise<void>;
  loadItems: () => Promise<void>;
  initializeDailyProgress: () => Promise<void>;
  loadDailyProgress: () => Promise<void>;
  createGroup: (title: string, drafts: CustomAthkarItemDraft[]) => Promise<number | null>;
  updateGroup: (id: number, title: string, drafts: CustomAthkarItemDraft[]) => Promise<boolean>;
  deleteGroup: (id: number) => Promise<void>;
  incrementCount: (customItemId: number) => void;
  decrementCount: (customItemId: number) => void;
  getGroupItems: (groupId: number) => CustomAthkarItem[];
  getGroupProgress: (groupId: number) => CustomAthkarProgress[];
};

type CustomAthkarStore = CustomAthkarState & CustomAthkarActions;

const debouncedDailyUpdate = createDebouncedQueue(
  async (dateInt: number, customItemId: number, currentCount: number) => {
    await AthkarDB.updateCustomAthkarDailyCount(dateInt, customItemId, currentCount);
  },
  300
);

export const useCustomAthkarStore = create<CustomAthkarStore>()(
  devtools(
    (set, get) => ({
      groups: [],
      items: [],
      progress: [],
      isInitialized: false,

      initialize: async () => {
        if (get().isInitialized) return;
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

        set({ groups, items, progress, isInitialized: true });
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
        set({ progress });
      },

      createGroup: async (title, drafts) => {
        const groupId = await AthkarDB.createCustomAthkarGroup(title, drafts);
        if (groupId === null) return null;
        await get().loadGroups();
        await get().loadItems();
        await get().initializeDailyProgress();
        await get().loadDailyProgress();
        return groupId;
      },

      updateGroup: async (id, title, drafts) => {
        const ok = await AthkarDB.updateCustomAthkarGroup(id, title, drafts);
        if (!ok) return false;
        await get().loadGroups();
        await get().loadItems();
        await get().initializeDailyProgress();
        await get().loadDailyProgress();
        return true;
      },

      deleteGroup: async (id) => {
        await AthkarDB.deleteCustomAthkarGroup(id);
        await get().loadGroups();
        await get().loadItems();
        await get().loadDailyProgress();
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
        const tz = locationStore.getState().locationDetails.timezone;
        const todayInt = getTodayInt(tz);
        debouncedDailyUpdate.add(String(customItemId), todayInt, customItemId, newCount);
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
        const tz = locationStore.getState().locationDetails.timezone;
        const todayInt = getTodayInt(tz);
        debouncedDailyUpdate.add(String(customItemId), todayInt, customItemId, newCount);
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
