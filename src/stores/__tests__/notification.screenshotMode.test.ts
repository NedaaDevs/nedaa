import { SchedulingSkipReason } from "@/enums/notifications";
import { useNotificationStore } from "@/stores/notification";
import { scheduleAllNotifications } from "@/utils/notificationScheduler";

jest.mock("@/screenshot-mode/flag", () => ({ IS_SCREENSHOT_MODE: true }));
jest.mock("expo-linking", () => ({ openSettings: jest.fn() }));
jest.mock("@/utils/notifications", () => ({ cancelAllScheduledNotifications: jest.fn() }));
jest.mock("@/utils/notificationScheduler", () => ({
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

// A screenshot build runs on a frozen clock, so every time it would schedule is past.
it("schedules nothing in a screenshot build", async () => {
  const result = await useNotificationStore.getState().scheduleAllNotifications();

  expect(result.skipReason).toBe(SchedulingSkipReason.SCREENSHOT_MODE);
  expect(scheduleAllNotifications).not.toHaveBeenCalled();
});
