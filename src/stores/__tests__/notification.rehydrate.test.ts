import { useNotificationStore } from "@/stores/notification";

const mockPersisted = {
  state: {
    isScheduling: true,
    lastScheduledDate: "2026-09-09T00:00:00.000Z",
    migrationVersion: 6,
  },
  version: 0,
};

jest.mock("expo-sqlite/kv-store", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(JSON.stringify(mockPersisted))),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock("expo-linking", () => ({ openSettings: jest.fn() }));
jest.mock("@/utils/notifications", () => ({ cancelAllScheduledNotifications: jest.fn() }));
jest.mock("@/utils/notificationScheduler", () => ({
  scheduleAllNotifications: jest.fn(),
  shouldReschedule: jest.fn(() => false),
}));
jest.mock("@/utils/customSoundManager", () => ({ buildUsedSoundsSet: jest.fn(() => new Set()) }));
jest.mock("@/services/qada-db", () => ({ QadaDB: { flush: jest.fn() } }));
jest.mock("@/stores/location", () => ({
  __esModule: true,
  default: { getState: jest.fn(() => ({})) },
}));
jest.mock("@/stores/prayerTimes", () => ({
  __esModule: true,
  default: { getState: jest.fn(() => ({})) },
}));

describe("notification store rehydration", () => {
  it("clears a scheduling lock persisted by a dead process", async () => {
    useNotificationStore.setState({ isScheduling: true });

    await useNotificationStore.persist.rehydrate();

    expect(useNotificationStore.getState().isScheduling).toBe(false);
  });

  it("keeps the persisted scheduling date while clearing the lock", async () => {
    await useNotificationStore.persist.rehydrate();

    const state = useNotificationStore.getState();
    expect(state.isScheduling).toBe(false);
    expect(state.lastScheduledDate).toBe("2026-09-09T00:00:00.000Z");
  });

  it("runs the reset ahead of the migration chain", async () => {
    await useNotificationStore.persist.rehydrate();

    // Migrations only run past a cleared lock if the reset preceded them.
    expect(useNotificationStore.getState().migrationVersion).toBeGreaterThanOrEqual(6);
    expect(useNotificationStore.getState().isScheduling).toBe(false);
  });
});
