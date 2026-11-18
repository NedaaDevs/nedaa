import { renderHook, waitFor } from "@testing-library/react-native";

jest.mock("@/services/athkar-db", () => ({
  AthkarDB: {
    getMyAthkar: jest.fn(),
    batchAddToMyAthkar: jest.fn(),
    initializeMyAthkarDaily: jest.fn(async () => true),
    getMyAthkarDailyProgress: jest.fn(async () => []),
    getCustomAthkarGroups: jest.fn(),
    getCustomAthkarItems: jest.fn(),
    initializeCustomAthkarDaily: jest.fn(async () => {}),
    getCustomAthkarDailyProgress: jest.fn(async () => []),
    updateCustomAthkarDailyCount: jest.fn(async () => {}),
    createCustomAthkarGroup: jest.fn(),
    updateCustomAthkarGroup: jest.fn(),
    deleteCustomAthkarGroup: jest.fn(),
  },
}));
jest.mock("@/services/hisn-muslim-db", () => ({
  HisnMuslimDB: {
    getAthkarByIds: jest.fn(async () => []),
    getCategoryForAthkar: jest.fn(async () => new Map()),
  },
}));
jest.mock("@/stores/location", () => ({
  __esModule: true,
  default: { getState: () => ({ locationDetails: { timezone: "Asia/Riyadh" } }) },
}));
jest.mock("@/utils/appLogger", () => ({
  AppLogger: { create: () => ({ i: jest.fn(), w: jest.fn(), e: jest.fn() }) },
}));

/* eslint-disable import/first -- imports must follow jest.mock hoisting */
import { useInitializeAthkarStores } from "@/hooks/useInitializeAthkarStores";
import { AthkarDB } from "@/services/athkar-db";
import { useCustomAthkarStore } from "@/stores/custom-athkar";
import { useMyAthkarStore } from "@/stores/my-athkar";
/* eslint-enable import/first */

const db = jest.mocked(AthkarDB);
const TODAY = 20261118;
const RIYADH_NOON = "2026-11-18T12:00:00+03:00";
const GROUP_ROW = { id: 7, title: "group", sort_order: 1, created_at: "" };
const ITEM_ROW = { id: 70, group_id: 7, arabic_text: "سبحان الله", user_count: 3, sort_order: 1 };
const DRAFTS = [{ id: ITEM_ROW.id, arabicText: ITEM_ROW.arabic_text, userCount: 1 }];
const HISN_ROW = { id: 1, source_athkar_id: 10, source_category_id: 5, user_count: 3 };
const READ_FAILED = new Error("read failed");

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers({ now: new Date(RIYADH_NOON) });
  db.getCustomAthkarGroups.mockResolvedValue([GROUP_ROW]);
  db.getCustomAthkarItems.mockResolvedValue([ITEM_ROW]);
  db.getMyAthkar.mockResolvedValue([HISN_ROW] as never);
  useCustomAthkarStore.setState({ isInitialized: false, loadFailed: false, groups: [], items: [] });
  useMyAthkarStore.setState({ isInitialized: false, loadFailed: false, items: [] });
});
afterEach(() => jest.useRealTimers());

const custom = () => useCustomAthkarStore.getState();
const mine = () => useMyAthkarStore.getState();

describe("loading the saved collections", () => {
  it("flags a custom read that fails, and a retry loads it", async () => {
    db.getCustomAthkarGroups.mockRejectedValueOnce(READ_FAILED);

    await expect(custom().initialize()).resolves.toBeUndefined();
    expect(custom()).toMatchObject({ isInitialized: false, loadFailed: true });

    await custom().initialize();
    expect(custom()).toMatchObject({ isInitialized: true, loadFailed: false });
    expect(custom().groups).toHaveLength(1);
  });

  it("flags a My Athkar read that fails, and a retry loads it", async () => {
    db.getMyAthkar.mockRejectedValueOnce(READ_FAILED);

    await expect(mine().initialize()).resolves.toBeUndefined();
    expect(mine()).toMatchObject({ isInitialized: false, loadFailed: true });

    await mine().initialize();
    expect(mine()).toMatchObject({ isInitialized: true, loadFailed: false });
  });

  it("loads the custom groups when My Athkar fails", async () => {
    db.getMyAthkar.mockRejectedValue(READ_FAILED);

    const { result } = await renderHook(() => useInitializeAthkarStores());

    await waitFor(() => expect(result.current.isCustomInit).toBe(true));
    expect(result.current).toMatchObject({ isMyAthkarInit: false, myAthkarFailed: true });
  });

  it("flags My Athkar when today's rows are not written, and a retry loads it", async () => {
    db.initializeMyAthkarDaily.mockResolvedValueOnce(false);

    await mine().initialize();
    expect(mine()).toMatchObject({ isInitialized: false, loadFailed: true });

    await mine().initialize();
    expect(mine()).toMatchObject({ isInitialized: true, loadFailed: false });
  });

  it("runs one load for two retries at once", async () => {
    db.getMyAthkar.mockRejectedValue(READ_FAILED);
    const { result } = await renderHook(() => useInitializeAthkarStores());
    await waitFor(() => expect(result.current.myAthkarFailed).toBe(true));
    db.getMyAthkar.mockClear();

    await Promise.all([result.current.retry(), result.current.retry()]);

    expect(db.getMyAthkar).toHaveBeenCalledTimes(1);
  });

  it("counts a full reload after a write as the load a failed start missed", async () => {
    db.getMyAthkar.mockRejectedValueOnce(READ_FAILED);
    db.getCustomAthkarGroups.mockRejectedValueOnce(READ_FAILED);
    await mine().initialize();
    await custom().initialize();
    db.batchAddToMyAthkar.mockResolvedValue([2]);
    db.createCustomAthkarGroup.mockResolvedValue(GROUP_ROW.id);

    await mine().batchAddItems([{ sourceAthkarId: 11, sourceCategoryId: 5, repeatCount: 1 }]);
    await custom().createGroup(GROUP_ROW.title, DRAFTS);

    expect(mine()).toMatchObject({ isInitialized: true, loadFailed: false });
    expect(custom()).toMatchObject({ isInitialized: true, loadFailed: false });
  });
});

describe("custom group writes", () => {
  beforeEach(() => custom().initialize());

  it("reports a committed group even when the reload after it fails", async () => {
    db.createCustomAthkarGroup.mockResolvedValue(GROUP_ROW.id);
    db.getCustomAthkarGroups.mockRejectedValueOnce(READ_FAILED);

    await expect(custom().createGroup(GROUP_ROW.title, DRAFTS)).resolves.toBe(GROUP_ROW.id);
    expect(custom().loadFailed).toBe(true);
  });

  it("reports an edit committed even when the reload after it fails", async () => {
    db.updateCustomAthkarGroup.mockResolvedValue(true);
    db.getCustomAthkarItems.mockRejectedValueOnce(READ_FAILED);

    await expect(custom().updateGroup(GROUP_ROW.id, GROUP_ROW.title, DRAFTS)).resolves.toBe(true);
    expect(custom().loadFailed).toBe(true);
  });

  it("writes a waiting count before the edit, which caps today's", async () => {
    db.getCustomAthkarDailyProgress.mockResolvedValue([
      { custom_item_id: ITEM_ROW.id, current_count: 0, total_count: ITEM_ROW.user_count },
    ]);
    await custom().loadDailyProgress();
    custom().incrementCount(ITEM_ROW.id);
    db.updateCustomAthkarGroup.mockResolvedValue(true);

    await custom().updateGroup(GROUP_ROW.id, GROUP_ROW.title, DRAFTS);

    expect(db.updateCustomAthkarGroup).toHaveBeenCalledWith(
      GROUP_ROW.id,
      GROUP_ROW.title,
      DRAFTS,
      TODAY
    );
    expect(db.updateCustomAthkarDailyCount.mock.invocationCallOrder[0]).toBeLessThan(
      db.updateCustomAthkarGroup.mock.invocationCallOrder[0]
    );
  });

  it("says a delete failed and keeps the group", async () => {
    db.deleteCustomAthkarGroup.mockResolvedValue(false);

    await expect(custom().deleteGroup(GROUP_ROW.id)).resolves.toBe(false);
    expect(custom().groups).toHaveLength(1);
  });

  it("keeps a deleted group out when a load that began before the delete lands after it", async () => {
    let land = () => {};
    db.getCustomAthkarDailyProgress.mockReturnValueOnce(
      new Promise((resolve) => {
        land = () => resolve([]);
      })
    );
    useCustomAthkarStore.setState({ loadFailed: true });
    const load = custom().initialize();
    await jest.advanceTimersByTimeAsync(0);

    db.deleteCustomAthkarGroup.mockResolvedValue(true);
    db.getCustomAthkarGroups.mockResolvedValue([]);
    db.getCustomAthkarItems.mockResolvedValue([]);
    await custom().deleteGroup(GROUP_ROW.id);
    land();
    await load;

    expect(custom().groups).toEqual([]);
  });

  it("says a delete succeeded once the group is gone", async () => {
    db.deleteCustomAthkarGroup.mockResolvedValue(true);
    db.getCustomAthkarGroups.mockResolvedValue([]);
    db.getCustomAthkarItems.mockResolvedValue([]);

    await expect(custom().deleteGroup(GROUP_ROW.id)).resolves.toBe(true);
    expect(custom().groups).toEqual([]);
  });
});

describe("adding to My Athkar", () => {
  beforeEach(() => mine().initialize());

  it("reports committed rows even when the reload after them fails", async () => {
    db.batchAddToMyAthkar.mockResolvedValue([2]);
    db.getMyAthkar.mockRejectedValueOnce(READ_FAILED);

    await expect(
      mine().batchAddItems([{ sourceAthkarId: 11, sourceCategoryId: 5, repeatCount: 1 }])
    ).resolves.toBe(true);
    expect(mine().loadFailed).toBe(true);
  });
});
