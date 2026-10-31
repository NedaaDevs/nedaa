import { SchedulingSkipReason } from "@/enums/notifications";
import { useNotificationStore } from "@/stores/notification";
import { cancelAllAlerts, scheduleAllNotifications } from "@/utils/notificationScheduler";

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

// Turning notifications off must also silence the native athans.
it("cancels every alert when notifications are off", async () => {
  useNotificationStore.setState((state) => ({ settings: { ...state.settings, enabled: false } }));

  const result = await useNotificationStore.getState().scheduleAllNotifications();

  expect(result.skipReason).toBe(SchedulingSkipReason.NOTIFICATIONS_DISABLED);
  expect(cancelAllAlerts).toHaveBeenCalledTimes(1);
  expect(scheduleAllNotifications).not.toHaveBeenCalled();
});
