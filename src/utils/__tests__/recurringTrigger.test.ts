import { scheduleRecurringNotification } from "@/utils/notifications";

const mockScheduleNotificationAsync = jest.fn(() => Promise.resolve("notif-id"));
const SchedulableTriggerInputTypes = {
  DAILY: "daily",
  WEEKLY: "weekly",
  CALENDAR: "calendar",
  TIME_INTERVAL: "timeInterval",
};

jest.mock("expo-notifications", () => ({
  __esModule: true,
  scheduleNotificationAsync: (...a: unknown[]) => mockScheduleNotificationAsync(...a),
  getPermissionsAsync: jest.fn(() => Promise.resolve({ status: "granted" })),
  setNotificationHandler: jest.fn(),
  AndroidNotificationPriority: { HIGH: "high" },
  PermissionStatus: { GRANTED: "granted" },
  SchedulableTriggerInputTypes,
}));

jest.mock("react-native", () => ({ Platform: { OS: "ios" } }));
jest.mock("expo-router", () => ({ useRouter: jest.fn() }));
jest.mock("expo-alarm", () => ({ stopAthan: jest.fn() }));
jest.mock("@/services/cleanup", () => ({ cleanupManager: { register: jest.fn() } }));

describe("scheduleRecurringNotification weekday", () => {
  beforeEach(() => mockScheduleNotificationAsync.mockClear());

  it("uses a WEEKLY trigger when weekday is provided", async () => {
    await scheduleRecurringNotification(9, 0, { title: "t", body: "b" }, { weekday: 6 });
    const arg = mockScheduleNotificationAsync.mock.calls[0][0] as {
      trigger: Record<string, unknown>;
    };
    expect(arg.trigger).toEqual({ type: "weekly", weekday: 6, hour: 9, minute: 0 });
  });

  it("uses a DAILY trigger when weekday is absent", async () => {
    await scheduleRecurringNotification(6, 30, { title: "t", body: "b" });
    const arg = mockScheduleNotificationAsync.mock.calls[0][0] as {
      trigger: Record<string, unknown>;
    };
    expect(arg.trigger).toEqual({ type: "daily", hour: 6, minute: 30 });
  });
});
