import { useNotificationStore } from "@/stores/notification";
import { cancelAllAlerts, scheduleAllNotifications } from "@/utils/notificationScheduler";

jest.mock("expo-sqlite/kv-store", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
  },
}));
jest.mock("expo-linking", () => ({ openSettings: jest.fn() }));
jest.mock("@/utils/notifications", () => ({ cancelAllScheduledNotifications: jest.fn() }));
jest.mock("@/utils/notificationScheduler", () => ({
  cancelAllAlerts: jest.fn(),
  scheduleAllNotifications: jest.fn(),
  shouldReschedule: jest.fn(() => false),
}));
jest.mock("@/utils/customSoundManager", () => ({ buildUsedSoundsSet: jest.fn(() => new Set()) }));
jest.mock("@/services/qada-db", () => ({
  QadaDB: {
    flush: jest.fn(),
    getSettings: jest.fn(() => Promise.resolve(null)),
    getRemainingCount: jest.fn(() => Promise.resolve(0)),
  },
}));
jest.mock("@/stores/location", () => ({
  __esModule: true,
  default: { getState: jest.fn(() => ({})) },
}));
jest.mock("@/stores/prayerTimes", () => ({
  __esModule: true,
  default: { getState: jest.fn(() => ({})) },
}));

// Turning notifications off must also silence the native athans.
it("cancels every alert when notifications are turned off", async () => {
  await useNotificationStore.getState().updateAllNotificationToggle(false);

  expect(useNotificationStore.getState().settings.enabled).toBe(false);
  expect(cancelAllAlerts).toHaveBeenCalledTimes(1);
  expect(scheduleAllNotifications).not.toHaveBeenCalled();
});
