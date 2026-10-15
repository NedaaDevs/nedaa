import { Platform } from "react-native";

import { PlatformType, type PlatformTypeValue } from "@/enums/app";
import { scheduleNotification, scheduleRecurringNotification } from "@/utils/notifications";
import type { NotificationOptions } from "@/types/notification";

const mockScheduleNotificationAsync = jest.fn((..._a: unknown[]) => Promise.resolve("notif-id"));

jest.mock("expo-notifications", () => ({
  __esModule: true,
  scheduleNotificationAsync: (...a: unknown[]) => mockScheduleNotificationAsync(...a),
  getPermissionsAsync: jest.fn(() => Promise.resolve({ status: "granted" })),
  setNotificationHandler: jest.fn(),
  AndroidNotificationPriority: { HIGH: "high" },
  PermissionStatus: { GRANTED: "granted" },
  SchedulableTriggerInputTypes: { DAILY: "daily", WEEKLY: "weekly", TIME_INTERVAL: "timeInterval" },
}));
jest.mock("@/services/cleanup", () => ({ cleanupManager: { register: jest.fn() } }));

const TIME_SENSITIVE = "timeSensitive";
const CONTENT = { title: "title", body: "body" };
const ONE_MINUTE_MS = 60_000;

const scheduledContent = () =>
  (mockScheduleNotificationAsync.mock.calls[0][0] as { content: Record<string, unknown> }).content;

// Both helpers take the same options, so one table drives them.
const HELPERS = [
  {
    name: "scheduleNotification",
    schedule: (options?: NotificationOptions) =>
      scheduleNotification(new Date(Date.now() + ONE_MINUTE_MS), CONTENT, options),
  },
  {
    name: "scheduleRecurringNotification",
    schedule: (options?: NotificationOptions) =>
      scheduleRecurringNotification(6, 30, CONTENT, options),
  },
];

const onPlatform = (os: PlatformTypeValue) => jest.replaceProperty(Platform, "OS", os);

describe.each(HELPERS)("$name and the iOS interruption level", ({ schedule }) => {
  beforeEach(() => mockScheduleNotificationAsync.mockClear());

  it("asks iOS for time-sensitive delivery when the caller does", async () => {
    onPlatform(PlatformType.IOS);
    await schedule({ timeSensitive: true });
    expect(scheduledContent().interruptionLevel).toBe(TIME_SENSITIVE);
  });

  it.each([
    { case: "no options", options: undefined },
    { case: "no timeSensitive option", options: { categoryId: "c" } },
    { case: "timeSensitive false", options: { timeSensitive: false } },
  ])("leaves the level unset on iOS with $case", async ({ options }) => {
    onPlatform(PlatformType.IOS);
    await schedule(options);
    expect(scheduledContent()).not.toHaveProperty("interruptionLevel");
  });

  it("never sets the level on Android", async () => {
    onPlatform(PlatformType.ANDROID);
    await schedule({ timeSensitive: true });
    expect(scheduledContent()).not.toHaveProperty("interruptionLevel");
  });
});
