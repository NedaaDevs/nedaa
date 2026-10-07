import type * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { NOTIFICATION_TYPE } from "@/constants/Notification";
import { PlatformType } from "@/enums/app";
import { handleNotificationResponse } from "@/utils/notificationResponse";

const mockNavigate = jest.fn();
jest.mock("expo-router", () => ({
  router: { navigate: (...args: unknown[]) => mockNavigate(...args) },
}));

const mockStopAthan = jest.fn();
jest.mock("expo-alarm", () => ({
  ...jest.requireActual("expo-alarm"),
  stopAthan: () => mockStopAthan(),
}));

const mockOpenSurah = jest.fn();
jest.mock("@/utils/notificationDeepLink", () => ({
  openQuranReminderTarget: (data: unknown) => mockOpenSurah(data),
}));

const mockLogError = jest.fn();
jest.mock("@/utils/appLogger", () => ({
  AppLogger: { create: () => ({ e: (...args: unknown[]) => mockLogError(...args) }) },
}));

const ATHKAR_SCREEN = "/(tabs)/athkar";
const QURAN_SCREEN = "/(tabs)/quran";

const FIRST_DELIVERY = Date.UTC(2026, 8, 28, 4, 30);
const NEXT_DELIVERY = Date.UTC(2026, 8, 29, 4, 30);

let nextId = 0;
const tapOn = (
  data: Record<string, unknown>,
  identifier = `tap-${nextId++}`,
  date = FIRST_DELIVERY
) =>
  ({
    actionIdentifier: "expo.modules.notifications.actions.DEFAULT",
    notification: { date, request: { identifier, content: { data } } },
  }) as unknown as Notifications.NotificationResponse;

const PLATFORM = Platform.OS;

describe("handleNotificationResponse", () => {
  beforeEach(() => jest.clearAllMocks());
  afterEach(() => {
    Platform.OS = PLATFORM;
  });

  it("opens the screen the notification names", () => {
    handleNotificationResponse(tapOn({ type: NOTIFICATION_TYPE.ATHKAR, screen: ATHKAR_SCREEN }));

    expect(mockNavigate).toHaveBeenCalledWith(ATHKAR_SCREEN);
  });

  it("opens the Quran tab and the reminder's surah", () => {
    handleNotificationResponse(
      tapOn({ type: NOTIFICATION_TYPE.QURAN_REMINDER, screen: QURAN_SCREEN, surah: 18 })
    );

    expect(mockNavigate).toHaveBeenCalledWith(QURAN_SCREEN);
    expect(mockOpenSurah).toHaveBeenCalledWith({ surah: 18 });
  });

  it("opens no surah when the payload's surah is not a number", () => {
    handleNotificationResponse(
      tapOn({ type: NOTIFICATION_TYPE.QURAN_REMINDER, screen: QURAN_SCREEN, surah: "18" })
    );

    expect(mockOpenSurah).toHaveBeenCalledWith({ surah: undefined });
  });

  // A launch tap reaches both the stored response and the listener.
  it("handles one tap once", () => {
    handleNotificationResponse(tapOn({ screen: ATHKAR_SCREEN }, "launch-tap"));
    handleNotificationResponse(tapOn({ screen: ATHKAR_SCREEN }, "launch-tap"));

    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  // A repeating reminder keeps one request identifier for every delivery.
  it("handles each delivery of a repeating reminder", () => {
    handleNotificationResponse(tapOn({ screen: ATHKAR_SCREEN }, "daily", FIRST_DELIVERY));
    handleNotificationResponse(tapOn({ screen: ATHKAR_SCREEN }, "daily", NEXT_DELIVERY));

    expect(mockNavigate).toHaveBeenCalledTimes(2);
  });

  it("logs a tap that fails with its error", () => {
    const failure = new Error("navigator not ready");
    mockNavigate.mockImplementationOnce(() => {
      throw failure;
    });
    handleNotificationResponse(tapOn({ screen: ATHKAR_SCREEN }, "failed-tap"));

    expect(mockLogError).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining("failed-tap"),
      failure
    );
  });

  it("stops the athan when a prayer notification is tapped on Android", () => {
    Platform.OS = PlatformType.ANDROID;
    handleNotificationResponse(tapOn({ type: NOTIFICATION_TYPE.PRAYER }));

    expect(mockStopAthan).toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
