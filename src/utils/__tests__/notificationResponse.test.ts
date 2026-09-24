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
jest.mock("expo-alarm", () => ({ stopAthan: () => mockStopAthan() }));

const mockOpenSurah = jest.fn();
jest.mock("@/utils/notificationDeepLink", () => ({
  openQuranReminderTarget: (data: unknown) => mockOpenSurah(data),
}));

const ATHKAR_SCREEN = "/(tabs)/athkar";
const QURAN_SCREEN = "/(tabs)/quran";

let nextId = 0;
const tapOn = (data: Record<string, unknown>, identifier = `tap-${nextId++}`) =>
  ({
    actionIdentifier: "expo.modules.notifications.actions.DEFAULT",
    notification: { request: { identifier, content: { data } } },
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

  // A launch tap reaches both the stored response and the listener.
  it("handles one tap once", () => {
    const tap = tapOn({ screen: ATHKAR_SCREEN }, "same-tap");
    handleNotificationResponse(tap);
    handleNotificationResponse(tap);

    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  it("stops the athan when a prayer notification is tapped on Android", () => {
    Platform.OS = PlatformType.ANDROID;
    handleNotificationResponse(tapOn({ type: NOTIFICATION_TYPE.PRAYER }));

    expect(mockStopAthan).toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
