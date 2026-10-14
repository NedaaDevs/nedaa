// First: expo-router's testing library re-mocks Reanimated as it loads, and the
// screen must bind to the mock below, not to its empty one.
import AlarmSettings from "@/app/settings/alarm";
import { Platform, Text } from "react-native";
import { usePathname } from "expo-router";
import { act, userEvent } from "@testing-library/react-native";
import { renderRouter, screen } from "expo-router/testing-library";

import {
  ALARM_PERMISSION,
  ALARM_PERMISSION_TITLE_KEY,
  type AlarmPermissionId,
} from "@/constants/Alarm";
import { BACK_DESTINATION } from "@/constants/BackDestinations";
import { E2E_ID } from "@/constants/E2E";
import { PlatformType } from "@/enums/app";
import i18n from "@/localization/i18n";
import { useLocationStore } from "@/stores/location";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { holdHydration } from "@/test-helpers/hydration";
import { normalizeRoutePath } from "@/test-helpers/routeTree";
import { ThemeProvider } from "@/test-helpers/theme";
import { readAlarmPermissions, type AlarmPermission } from "@/utils/alarmPermissions";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("@gorhom/bottom-sheet", () => jest.requireActual("@/test-helpers/bottomSheetMock"));
jest.mock("expo-alarm", () => ({ ...jest.requireActual("expo-alarm") }));
jest.mock("@/utils/alarmPermissions", () => ({
  ...jest.requireActual("@/utils/alarmPermissions"),
  readAlarmPermissions: jest.fn(),
  requestAlarmPermission: jest.fn(),
}));
jest.mock("@/utils/alarmReport", () => ({}));

const Pathname = () => <Text testID="pathname">{usePathname()}</Text>;

const renderScreen = () =>
  renderRouter(
    {
      [BACK_DESTINATION.SETTINGS_ALARM.route]: () => <AlarmSettings />,
      [BACK_DESTINATION.SETTINGS_CUSTOM_SOUNDS.route]: () => <Pathname />,
      [BACK_DESTINATION.SETTINGS_LOCATION.route]: () => <Pathname />,
    },
    {
      initialUrl: BACK_DESTINATION.SETTINGS_ALARM.href as string,
      wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider>,
    }
  );

const customSounds = () =>
  screen.queryByRole("button", { name: i18n.t("notification.customSound.manage") });

const {
  NOTIFICATIONS: N,
  EXACT_ALARM: E,
  FULL_SCREEN: F,
  OVERLAY: O,
  BATTERY: B,
} = ALARM_PERMISSION;
const ANDROID = [N, E, F, O, B];

/** This device's Android items, these ones still missing. */
const missing = (...ids: AlarmPermissionId[]) =>
  jest.mocked(readAlarmPermissions).mockResolvedValue(
    ANDROID.map((id): AlarmPermission => ({
      id,
      granted: !ids.includes(id),
      canRequestInApp: false,
    }))
  );

const t = i18n.t.bind(i18n);
const pageTitle = (id: AlarmPermissionId) => t(ALARM_PERMISSION_TITLE_KEY[id]);
const reportProblem = () =>
  screen.findByRole("button", { name: t("alarm.settings.reportProblem") });
const notNow = () => screen.queryByRole("button", { name: t("common.notNow") });

beforeEach(() => {
  jest.replaceProperty(Platform, "OS", PlatformType.ANDROID);
  usePrayerTimesStore.setState({ usingDefaultLocation: false });
  // Every permission granted, so the screen draws its alarms.
  jest.mocked(readAlarmPermissions).mockReset().mockResolvedValue([]);
});

describe("Alarm settings city gate", () => {
  it("asks for the city first while the times are the default location's", async () => {
    usePrayerTimesStore.setState({ usingDefaultLocation: true });
    missing(N);
    await renderScreen();

    expect(await screen.findByText(t("alarm.settings.cityNeeded.title"))).toBeTruthy();
    expect(screen.getByText(t("alarm.settings.cityNeeded.body"))).toBeTruthy();
    expect(screen.queryByText(pageTitle(N))).toBeNull();
    expect(screen.queryByLabelText(t("a11y.stepProgress", { current: 1, total: 5 }))).toBeNull();
    expect(notNow()).toBeNull();
  });

  it("opens the location settings from its button", async () => {
    usePrayerTimesStore.setState({ usingDefaultLocation: true });
    await renderScreen();

    const button = await screen.findByRole("button", {
      name: t("alarm.settings.cityNeeded.action"),
    });
    expect(button.props.accessibilityHint).toBe(t("a11y.today.locationHint"));
    await userEvent.press(button);

    expect(screen.getByTestId("pathname")).toHaveTextContent(
      normalizeRoutePath(BACK_DESTINATION.SETTINGS_LOCATION.href)
    );
  });

  it("opens the location settings from the button the CI flow taps", async () => {
    usePrayerTimesStore.setState({ usingDefaultLocation: true });
    await renderScreen();

    await userEvent.press(await screen.findByTestId(E2E_ID.ALARM_CHOOSE_CITY));

    expect(screen.getByTestId("pathname")).toHaveTextContent(
      normalizeRoutePath(BACK_DESTINATION.SETTINGS_LOCATION.href)
    );
  });

  it("gives way to the alarms once a city lands", async () => {
    usePrayerTimesStore.setState({ usingDefaultLocation: true });
    await renderScreen();
    await screen.findByText(t("alarm.settings.cityNeeded.title"));

    await act(async () => usePrayerTimesStore.setState({ usingDefaultLocation: false }));

    expect(await reportProblem()).toBeTruthy();
    expect(screen.queryByText(t("alarm.settings.cityNeeded.title"))).toBeNull();
  });

  it("asks for the city until the stored place loads, then gives way", async () => {
    const held = holdHydration(useLocationStore);
    try {
      await renderScreen();
      expect(await screen.findByText(t("alarm.settings.cityNeeded.title"))).toBeTruthy();

      await act(async () => held.land());

      expect(await reportProblem()).toBeTruthy();
      expect(screen.queryByText(t("alarm.settings.cityNeeded.title"))).toBeNull();
    } finally {
      held.restore();
    }
  });

  it("shows the permissions at a verified place", async () => {
    missing(E);
    await renderScreen();

    expect(await screen.findByText(pageTitle(E))).toBeTruthy();
    expect(screen.queryByText(t("alarm.settings.cityNeeded.title"))).toBeNull();
  });
});

describe("Alarm settings permission gate", () => {
  it("blocks on a missing needed item, with no way past it", async () => {
    missing(E, F);
    await renderScreen();

    expect(await screen.findByText(pageTitle(E))).toBeTruthy();
    expect(screen.getByRole("button", { name: t("alarm.permission.openSettings") })).toBeTruthy();
    expect(notNow()).toBeNull();
  });

  it("offers Not now on a missing improvement, which shows the next one", async () => {
    missing(F, B);
    await renderScreen();

    expect(await screen.findByText(pageTitle(F))).toBeTruthy();
    expect(screen.getByLabelText(t("a11y.stepProgress", { current: 3, total: 5 }))).toBeTruthy();
    await userEvent.press(notNow()!);

    expect(screen.getByText(pageTitle(B))).toBeTruthy();
    expect(screen.getByLabelText(t("a11y.stepProgress", { current: 5, total: 5 }))).toBeTruthy();
  });

  it("shows the alarms once every missing improvement is passed", async () => {
    missing(O);
    await renderScreen();
    await screen.findByText(pageTitle(O));

    await userEvent.press(notNow()!);

    expect(await reportProblem()).toBeTruthy();
  });

  it("names both buttons by their visible words", async () => {
    missing(F);
    await renderScreen();
    await screen.findByText(pageTitle(F));

    for (const name of [t("alarm.permission.openSettings"), t("common.notNow")]) {
      const button = screen.getByRole("button", { name });
      expect(button).toHaveTextContent(name);
    }
  });
});

describe("Alarm settings custom sounds", () => {
  it("links to custom sounds on Android", async () => {
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
