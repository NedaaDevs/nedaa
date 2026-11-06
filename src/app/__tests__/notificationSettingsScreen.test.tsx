// First: expo-router's testing library re-mocks Reanimated as it loads,
// and the screen must bind to the mock below, not to its empty one.
import NotificationSettings from "@/app/settings/notification";
import { userEvent } from "@testing-library/react-native";
import { usePathname } from "expo-router";
import { renderRouter, screen } from "expo-router/testing-library";
import * as Notifications from "expo-notifications";
import { Platform, Text } from "react-native";

import { BACK_DESTINATION } from "@/constants/BackDestinations";
import { NOTIFICATION_TYPE } from "@/constants/Notification";
import { PRAYER_ID } from "@/constants/Prayer";
import type { PrayerSoundKey } from "@/constants/sounds";
import { PlatformType } from "@/enums/app";
import i18n from "@/localization/i18n";
import { useNotificationStore } from "@/stores/notification";
import { normalizeRoutePath } from "@/test-helpers/routeTree";
import { ThemeProvider } from "@/test-helpers/theme";
import { createNotificationChannels } from "@/utils/notificationChannels";
import { scheduleNotification } from "@/utils/notifications";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("expo-notifications", () => ({
  ...jest.requireActual("expo-notifications"),
  getNotificationChannelsAsync: jest.fn(() => Promise.resolve([])),
  deleteNotificationChannelAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
}));
jest.mock("@/utils/notifications", () => ({
  checkPermissions: jest.fn(() => Promise.resolve({ status: "granted" })),
  requestNotificationPermission: jest.fn(),
  scheduleNotification: jest.fn(() => Promise.resolve({ success: true })),
  cancelAllScheduledNotifications: jest.fn(),
}));
jest.mock("@/utils/notificationScheduler", () => ({
  scheduleAllNotifications: jest.fn(() => Promise.resolve({ success: true, scheduledCount: 0 })),
  shouldReschedule: jest.fn(() => false),
}));
jest.mock("@/services/qada-db", () => ({
  QadaDB: {
    flush: jest.fn(),
    getSettings: jest.fn(() => Promise.resolve(null)),
    getRemainingCount: jest.fn(() => Promise.resolve(0)),
  },
}));
jest.mock("expo-alarm", () => ({
  ...jest.requireActual("expo-alarm"),
  scheduleAthan: jest.fn(),
  stopAthan: jest.fn(),
  isAthanPlaying: jest.fn(),
}));
// The sound helpers reach the athkar store, which opens SQLite.
jest.mock("@/stores/athkar", () => ({ useAthkarStore: { getState: jest.fn() } }));
jest.mock("@/components/ScheduledNotificationDebugModal", () => () => null);
jest.mock("@/components/NotificationQuickSetup", () => () => null);
jest.mock("@/components/NotificationTypePanel", () => () => null);

const FAJR_SOUND: PrayerSoundKey = "athan2";
// A dev-only control, so its label is English and not in the locales.
const TEST_ALERT = "Test Notification (10s)";

const created = Notifications.setNotificationChannelAsync as jest.Mock;
const scheduled = scheduleNotification as jest.Mock;

const Pathname = () => <Text testID="pathname">{usePathname()}</Text>;

const renderScreen = () =>
  renderRouter(
    {
      "settings/notification": () => <NotificationSettings />,
      [BACK_DESTINATION.SETTINGS_ATHAN_PLAYBACK.route]: () => <Pathname />,
      [BACK_DESTINATION.SETTINGS_OTHER_REMINDERS.route]: () => <Pathname />,
    },
    {
      initialUrl: "/settings/notification",
      wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider>,
    }
  );

describe("Notification settings debug alert", () => {
  beforeEach(() => {
    jest.replaceProperty(Platform, "OS", "android");
    useNotificationStore.setState((state) => ({
      fullAthanPlayback: false,
      settings: {
        ...state.settings,
        enabled: true,
        overrides: {
          [PRAYER_ID.FAJR]: {
            [NOTIFICATION_TYPE.PRAYER]: { sound: FAJR_SOUND, vibration: false },
          },
        },
      },
    }));
    created.mockClear();
    scheduled.mockClear();
  });

  // Android posts a notification on a missing channel to its fallback channel.
  it("posts on the channel Fajr's own settings create", async () => {
    await createNotificationChannels(useNotificationStore.getState().settings);
    const madeIds = created.mock.calls.map(([id]) => id);
    await renderScreen();

    await userEvent.press(await screen.findByText(TEST_ALERT));

    const [, , options] = scheduled.mock.calls[0];
    expect(madeIds).toContain(options.channelId);
  });

  it("counts the custom settings as one phrase", async () => {
    await renderScreen();

    expect(await screen.findByText("1 custom setting")).toBeTruthy();
  });

  it.each([BACK_DESTINATION.SETTINGS_ATHAN_PLAYBACK, BACK_DESTINATION.SETTINGS_OTHER_REMINDERS])(
    "says where the row goes, then opens $route",
    async (destination) => {
      await renderScreen();
      const title = i18n.t(destination.title);

      const row = await screen.findByRole("button", { name: title });
      expect(row).toHaveProp("accessibilityHint", i18n.t("a11y.opens", { name: title }));
      await userEvent.press(row);

      expect(screen.getByTestId("pathname")).toHaveTextContent(
        normalizeRoutePath(destination.href)
      );
    }
  );

  it("offers athan playback on Android only", async () => {
    jest.replaceProperty(Platform, "OS", PlatformType.IOS);
    await renderScreen();

    await screen.findByRole("button", {
      name: i18n.t(BACK_DESTINATION.SETTINGS_OTHER_REMINDERS.title),
    });
    expect(
      screen.queryByRole("button", {
        name: i18n.t(BACK_DESTINATION.SETTINGS_ATHAN_PLAYBACK.title),
      })
    ).toBeNull();
  });
});
