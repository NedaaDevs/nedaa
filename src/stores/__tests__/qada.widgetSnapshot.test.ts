const mockSync = jest.fn(async () => {});
jest.mock("@/services/widgetSnapshot", () => ({ syncWidgetSnapshot: () => mockSync() }));

jest.mock("@/services/qada-db", () => ({
  QadaDB: {
    initialize: jest.fn(async () => {}),
    getQadaFast: jest.fn(async () => ({
      id: 1,
      total_missed: 3,
      total_completed: 1,
      created_at: "",
      updated_at: "",
    })),
    getHistory: jest.fn(async () => []),
    getPendingEntries: jest.fn(async () => []),
    getSettings: jest.fn(async () => null),
    addMissedFasts: jest.fn(async () => true),
    resetAll: jest.fn(async () => true),
    updateEntryStatus: jest.fn(async () => true),
    completeOneDayFromEntry: jest.fn(async (): Promise<number | null> => 41),
    restoreCompletion: jest.fn(async (id: number) => id > 0),
    updateQadaFast: jest.fn(async () => true),
    updateSettings: jest.fn(async () => true),
    getRemainingCount: jest.fn(async () => 3),
  },
}));
jest.mock("@/utils/qadaNotificationScheduler", () => ({
  scheduleQadaNotifications: jest.fn(async () => {}),
  cancelAllQadaNotifications: jest.fn(async () => {}),
}));
jest.mock("@/localization/i18n", () => ({ __esModule: true, default: { t: (k: string) => k } }));
jest.mock("@/stores/notification", () => ({
  useNotificationStore: { getState: () => ({ settings: { enabled: false } }) },
}));
jest.mock("@/stores/customSounds", () => ({ useCustomSoundsStore: { getState: () => ({}) } }));
jest.mock("@/stores/screenshotStore", () => ({
  useScreenshotStore: { getState: () => ({ active: false }) },
}));
jest.mock("@/screenshot-mode/useScreenshotSeed", () => ({ selectScreenshotSeed: () => null }));
jest.mock("expo-sqlite/kv-store", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => {}),
    removeItem: jest.fn(async () => {}),
  },
}));
jest.mock("@/utils/appLogger", () => ({
  AppLogger: { create: () => ({ i: jest.fn(), w: jest.fn(), e: jest.fn() }) },
}));

// eslint-disable-next-line import/first -- imports must follow jest.mock hoisting
import { QadaDB } from "@/services/qada-db";
// eslint-disable-next-line import/first -- imports must follow jest.mock hoisting
import { useQadaStore } from "@/stores/qada";

beforeEach(() => jest.clearAllMocks());

describe("qada store → widget snapshot", () => {
  test("loadData syncs once the totals are in", async () => {
    await useQadaStore.getState().loadData();
    expect(mockSync).toHaveBeenCalledTimes(1);
  });

  test("addMissed syncs after the write", async () => {
    await useQadaStore.getState().addMissed(2);
    expect(mockSync).toHaveBeenCalledTimes(1);
  });

  test("resetAll syncs so the widget clears", async () => {
    await useQadaStore.getState().resetAll();
    expect(mockSync).toHaveBeenCalledTimes(1);
  });

  test("restoreDay syncs after the day is owed again", async () => {
    await expect(useQadaStore.getState().restoreDay(7)).resolves.toBe(true);
    expect(mockSync).toHaveBeenCalledTimes(1);
  });

  test("restoreDay leaves the widget alone when nothing changed", async () => {
    await expect(useQadaStore.getState().restoreDay(0)).resolves.toBe(false);
    expect(mockSync).not.toHaveBeenCalled();
  });
});

describe("qada store totals", () => {
  test("addMissed grows the total owed with the days remaining", async () => {
    useQadaStore.setState({ totalMissed: 0, totalCompleted: 3, totalOriginal: 3 });

    await useQadaStore.getState().addMissed(7);

    expect(useQadaStore.getState()).toMatchObject({ totalMissed: 7, totalOriginal: 10 });
  });
});

describe("qada store writes", () => {
  const writes = () => useQadaStore.getState().writes;

  test("completeEntry resolves to the recorded day's ledger id", async () => {
    await expect(useQadaStore.getState().completeEntry(1)).resolves.toBe(41);
  });

  test("completeEntry resolves to null when nothing was recorded", async () => {
    jest.mocked(QadaDB.completeOneDayFromEntry).mockResolvedValueOnce(null);
    await expect(useQadaStore.getState().completeEntry(1)).resolves.toBeNull();
  });

  test.each([
    ["addMissed", () => useQadaStore.getState().addMissed(2)],
    ["completeEntry", () => useQadaStore.getState().completeEntry(1)],
    ["completeSpecificEntry", () => useQadaStore.getState().completeSpecificEntry(1)],
    ["completeAllEntries", () => useQadaStore.getState().completeAllEntries()],
    ["deleteEntry", () => useQadaStore.getState().deleteEntry(1)],
    ["restoreDay", () => useQadaStore.getState().restoreDay(7)],
    ["resetAll", () => useQadaStore.getState().resetAll()],
  ])("%s counts as a write", async (_name, write) => {
    const before = writes();
    await write();
    expect(writes()).toBe(before + 1);
  });

  test("a write that changes nothing is not counted", async () => {
    const before = writes();
    await useQadaStore.getState().restoreDay(0);
    expect(writes()).toBe(before);
  });

  test("loading is not a write", async () => {
    const before = writes();
    await useQadaStore.getState().loadData();
    expect(writes()).toBe(before);
  });

  test("loadData reads every batch, not only the newest", async () => {
    await useQadaStore.getState().loadData();
    expect(QadaDB.getHistory).toHaveBeenCalledWith();
  });
});
