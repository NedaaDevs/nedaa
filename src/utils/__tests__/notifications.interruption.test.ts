import {
  AndroidNotificationPriority,
  SchedulableTriggerInputTypes,
  type NotificationContentInput,
} from "expo-notifications";
import { Platform } from "react-native";

import { SYSTEM_SOUND } from "@/constants/Notification";
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
const CUSTOM_SOUND = "athan.wav";
const VIBRATION_PATTERN = [0, 500, 200, 500];
const ONE_MINUTE_MS = 60_000;

const scheduledRequest = () =>
  mockScheduleNotificationAsync.mock.calls[0][0] as {
    content: Record<string, unknown>;
    trigger: Record<string, unknown>;
  };
const scheduledContent = () => scheduledRequest().content;
const CHANNEL_ID = "channel";
/** Expo numbers weekdays from 1 for Sunday. */
const FRIDAY = 6;

// Both helpers take the same options, so one table drives them.
const HELPERS = [
  {
    name: "scheduleNotification",
    schedule: (options?: NotificationOptions, content: NotificationContentInput = CONTENT) =>
      scheduleNotification(new Date(Date.now() + ONE_MINUTE_MS), content, options),
  },
  {
    name: "scheduleRecurringNotification",
    schedule: (options?: NotificationOptions, content: NotificationContentInput = CONTENT) =>
      scheduleRecurringNotification(6, 30, content, options),
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

describe.each(HELPERS)("$name and the platform content", ({ schedule }) => {
  beforeEach(() => mockScheduleNotificationAsync.mockClear());

  it("asks Android for high priority", async () => {
    onPlatform(PlatformType.ANDROID);
    await schedule();
    expect(scheduledContent().priority).toBe(AndroidNotificationPriority.HIGH);
  });

  it.each([
    { platform: PlatformType.ANDROID, sound: CUSTOM_SOUND },
    { platform: PlatformType.ANDROID, sound: SYSTEM_SOUND },
    { platform: PlatformType.IOS, sound: CUSTOM_SOUND },
    { platform: PlatformType.IOS, sound: SYSTEM_SOUND },
  ])("keeps the $sound sound on $platform", async ({ platform, sound }) => {
    onPlatform(platform);
    await schedule(undefined, { ...CONTENT, sound });
    expect(scheduledContent().sound).toBe(sound);
  });

  it.each([
    { vibrate: true, pattern: VIBRATION_PATTERN },
    { vibrate: false, pattern: [] },
  ])("vibrates Android with $pattern for vibrate $vibrate", async ({ vibrate, pattern }) => {
    onPlatform(PlatformType.ANDROID);
    await schedule({ vibrate });
    expect(scheduledContent().vibrate).toEqual(pattern);
  });

  it("leaves the Android vibration to the channel without the option", async () => {
    onPlatform(PlatformType.ANDROID);
    await schedule();
    expect(scheduledContent()).not.toHaveProperty("vibrate");
  });

  it("sets no priority or vibration on iOS", async () => {
    onPlatform(PlatformType.IOS);
    await schedule({ vibrate: true });
    expect(scheduledContent()).not.toHaveProperty("priority");
    expect(scheduledContent()).not.toHaveProperty("vibrate");
  });

  it("adds the category to the caller's data", async () => {
    onPlatform(PlatformType.ANDROID);
    const categoryId = "category";
    await schedule({ categoryId }, { ...CONTENT, data: { kept: true } });
    expect(scheduledContent().data).toEqual({ kept: true, categoryId });
  });
});

describe.each(HELPERS)("$name and the Android channel", ({ schedule }) => {
  beforeEach(() => mockScheduleNotificationAsync.mockClear());

  it("puts the caller's channel on the Android trigger", async () => {
    onPlatform(PlatformType.ANDROID);
    await schedule({ channelId: CHANNEL_ID });
    expect(scheduledRequest().trigger.channelId).toBe(CHANNEL_ID);
  });

  // iOS has no channels.
  it("leaves the channel off the iOS trigger", async () => {
    onPlatform(PlatformType.IOS);
    await schedule({ channelId: CHANNEL_ID });
    expect(scheduledRequest().trigger.channelId).toBeUndefined();
  });

  it("leaves the channel off the trigger when the caller gives none", async () => {
    onPlatform(PlatformType.ANDROID);
    await schedule();
    expect(scheduledRequest().trigger.channelId).toBeUndefined();
  });
});

// A weekday makes a weekly trigger, which carries the channel too.
it("puts the caller's channel on a weekly Android trigger", async () => {
  mockScheduleNotificationAsync.mockClear();
  onPlatform(PlatformType.ANDROID);
  await scheduleRecurringNotification(6, 30, CONTENT, { channelId: CHANNEL_ID, weekday: FRIDAY });
  expect(scheduledRequest().trigger).toEqual(
    expect.objectContaining({
      type: SchedulableTriggerInputTypes.WEEKLY,
      channelId: CHANNEL_ID,
    })
  );
});
