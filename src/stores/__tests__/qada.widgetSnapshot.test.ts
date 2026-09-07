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
    completeOneDayFromEntry: jest.fn(async () => true),
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
});
