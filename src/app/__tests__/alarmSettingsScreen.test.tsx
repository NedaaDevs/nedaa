// First: expo-router's testing library re-mocks Reanimated as it loads, and the
// screen must bind to the mock below, not to its empty one.
import AlarmSettings from "@/app/settings/alarm";
import { Platform, Text } from "react-native";
import { usePathname } from "expo-router";
import { userEvent } from "@testing-library/react-native";
import { renderRouter, screen } from "expo-router/testing-library";

import { BACK_DESTINATION } from "@/constants/BackDestinations";
import { PlatformType } from "@/enums/app";
import i18n from "@/localization/i18n";
import { normalizeRoutePath } from "@/test-helpers/routeTree";
import { ThemeProvider } from "@/test-helpers/theme";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("@gorhom/bottom-sheet", () => jest.requireActual("@/test-helpers/bottomSheetMock"));
jest.mock("expo-alarm", () => ({ ...jest.requireActual("expo-alarm") }));
// Every permission granted, so the screen draws its alarms.
jest.mock("@/utils/alarmPermissions", () => ({
  readAlarmPermissions: jest.fn(() => Promise.resolve([])),
}));
jest.mock("@/utils/alarmReport", () => ({}));

const Pathname = () => <Text testID="pathname">{usePathname()}</Text>;

const renderScreen = () =>
  renderRouter(
    {
      [BACK_DESTINATION.SETTINGS_ALARM.route]: () => <AlarmSettings />,
      [BACK_DESTINATION.SETTINGS_CUSTOM_SOUNDS.route]: () => <Pathname />,
    },
    {
      initialUrl: BACK_DESTINATION.SETTINGS_ALARM.href as string,
      wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider>,
    }
  );

const customSounds = () =>
  screen.queryByRole("button", { name: i18n.t("notification.customSound.manage") });

describe("Alarm settings custom sounds", () => {
  it("links to custom sounds on Android", async () => {
    jest.replaceProperty(Platform, "OS", PlatformType.ANDROID);
    await renderScreen();

    const link = await screen.findByRole("button", {
      name: i18n.t("notification.customSound.manage"),
    });
    expect(link.props.accessibilityHint).toBe(
      i18n.t("a11y.opens", { name: i18n.t(BACK_DESTINATION.SETTINGS_CUSTOM_SOUNDS.title) })
    );

    await userEvent.press(link);

    expect(screen.getByTestId("pathname")).toHaveTextContent(
      normalizeRoutePath(BACK_DESTINATION.SETTINGS_CUSTOM_SOUNDS.href)
    );
  });

  // iOS plays only the sounds bundled with the app.
  it("leaves custom sounds off on iOS", async () => {
    jest.replaceProperty(Platform, "OS", PlatformType.IOS);
    await renderScreen();
    await screen.findByRole("button", { name: i18n.t("alarm.settings.reportProblem") });

    expect(customSounds()).toBeNull();
  });
});
