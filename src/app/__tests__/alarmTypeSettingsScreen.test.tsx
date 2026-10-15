// First: expo-router's testing library re-mocks Reanimated as it loads, and the
// screen must bind to the mock below, not to its empty one.
import AlarmTypeSettingsScreen from "@/app/settings/alarm/[type]";
import { Text } from "react-native";
import { usePathname } from "expo-router";
import { act, fireEvent } from "@testing-library/react-native";
import { renderRouter, screen } from "expo-router/testing-library";

import {
  ALARM_PERMISSION,
  ALARM_SETTINGS_ROUTE,
  ALARM_TYPE,
  type AlarmPermissionId,
} from "@/constants/Alarm";
import { BACK_DESTINATION } from "@/constants/BackDestinations";
import i18n from "@/localization/i18n";
import { useAlarmStore } from "@/stores/alarm";
import { useAlarmSettingsStore } from "@/stores/alarmSettings";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { armFajr } from "@/test-helpers/armedAlarm";
import { later } from "@/test-helpers/promises";
import { normalizeRoutePath } from "@/test-helpers/routeTree";
import { ThemeProvider } from "@/test-helpers/theme";
import { readAlarmPermissions, type AlarmPermission } from "@/utils/alarmPermissions";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("@/hooks/useHaptic", () => ({ useHaptic: () => jest.fn() }));
// The alarm's own sections have their own tests; here they draw nothing.
jest.mock("@/components/alarm", () => {
  const none = () => null;
  return {
    SoundPicker: none,
    VolumeSlider: none,
    ChallengePicker: none,
    GentleWakeUpSettings: none,
    VibrationSettings: none,
    SnoozeSettings: none,
    TimingSettings: none,
  };
});
jest.mock("@/utils/alarmPermissions", () => ({
  ...jest.requireActual("@/utils/alarmPermissions"),
  readAlarmPermissions: jest.fn(),
}));

const mockSetEnabled = jest.fn(async (_enabled: boolean) => {});
jest.mock("@/hooks/useAlarmTypeSettings", () => {
  const { useAlarmSettingsStore } = jest.requireActual("@/stores/alarmSettings");
  return {
    useAlarmTypeSettings: (type: string) => ({
      settings: useAlarmSettingsStore((state: Record<string, unknown>) => state[type]),
      update: () => {},
      setEnabled: (enabled: boolean) => mockSetEnabled(enabled),
    }),
  };
});

const Pathname = () => <Text testID="pathname">{usePathname()}</Text>;

const renderScreen = () =>
  renderRouter(
    {
      [ALARM_SETTINGS_ROUTE]: () => <AlarmTypeSettingsScreen />,
      [BACK_DESTINATION.SETTINGS_ALARM.route]: () => <Pathname />,
    },
    {
      initialUrl: `${BACK_DESTINATION.SETTINGS_ALARM.href}/${ALARM_TYPE.FAJR}`,
      wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider>,
    }
  );

const {
  NOTIFICATIONS: N,
  EXACT_ALARM: E,
  FULL_SCREEN: F,
  OVERLAY: O,
  BATTERY: B,
} = ALARM_PERMISSION;
/** An Android device's items, these ones still missing. */
const missing = (...ids: AlarmPermissionId[]) =>
  jest.mocked(readAlarmPermissions).mockResolvedValue(
    [N, E, F, O, B].map((id): AlarmPermission => ({
      id,
      granted: !ids.includes(id),
      canRequestInApp: false,
    }))
  );

const enableSwitch = () =>
  screen.findByRole("switch", { name: i18n.t("alarm.settings.enableAlarm") });
// A native switch has no press responder in tests, so its change is fired.
const turnOn = async () => {
  const toggle = await enableSwitch();
  await act(async () => fireEvent(toggle, "valueChange", true));
};

/** The switch, turned on: the alarm stays off, at the alarm gate. */
const expectGate = async () => {
  await renderScreen();

  await turnOn();

  expect(mockSetEnabled).not.toHaveBeenCalled();
  expect(screen.getByTestId("pathname")).toHaveTextContent(
    normalizeRoutePath(BACK_DESTINATION.SETTINGS_ALARM.href)
  );
};

beforeEach(() => {
  mockSetEnabled.mockClear();
  jest.mocked(readAlarmPermissions).mockReset();
  missing();
  usePrayerTimesStore.setState({ usingDefaultLocation: false });
  useAlarmSettingsStore.setState(useAlarmSettingsStore.getInitialState());
  useAlarmStore.setState({ scheduledAlarms: {} });
});

describe("the alarm's own switch", () => {
  // The alarm would ring at the default location's times, not the user's.
  it("opens the alarm gate at the default location's times", async () => {
    usePrayerTimesStore.setState({ usingDefaultLocation: true });
    await expectGate();
    expect(readAlarmPermissions).not.toHaveBeenCalled();
  });

  it("opens the alarm gate while a needed item is missing", async () => {
    missing(N);
    await expectGate();
  });

  it("opens the alarm gate when the permission read fails", async () => {
    jest.mocked(readAlarmPermissions).mockRejectedValue(new Error("alarm module down"));
    await expectGate();
  });

  it("turns the alarm on with only improvements missing", async () => {
    missing(F, O, B);
    await renderScreen();

    await turnOn();

    expect(mockSetEnabled).toHaveBeenCalledWith(true);
  });

  it("ignores a second flip while the first check is still reading", async () => {
    const read = later<AlarmPermission[]>();
    jest.mocked(readAlarmPermissions).mockReturnValueOnce(read.promise);
    await renderScreen();
    const toggle = await enableSwitch();

    await act(async () => fireEvent(toggle, "valueChange", true));
    await act(async () => fireEvent(toggle, "valueChange", true));
    await act(async () => read.release([]));

    expect(readAlarmPermissions).toHaveBeenCalledTimes(1);
    expect(mockSetEnabled).not.toHaveBeenCalled();
  });

  it("turns the alarm off without a check", async () => {
    missing(E);
    useAlarmSettingsStore.setState({
      [ALARM_TYPE.FAJR]: { ...useAlarmSettingsStore.getState()[ALARM_TYPE.FAJR], enabled: true },
    });
    await renderScreen();

    const toggle = await enableSwitch();
    await act(async () => fireEvent(toggle, "valueChange", false));

    expect(mockSetEnabled).toHaveBeenCalledWith(false);
    expect(readAlarmPermissions).not.toHaveBeenCalled();
  });

  // An armed alarm rings whatever the place reads, so the switch reads On.
  it("reads On while armed at the default location's times, and turns off", async () => {
    useAlarmSettingsStore.setState({
      [ALARM_TYPE.FAJR]: { ...useAlarmSettingsStore.getState()[ALARM_TYPE.FAJR], enabled: true },
    });
    usePrayerTimesStore.setState({ usingDefaultLocation: true });
    armFajr();
    await renderScreen();

    const toggle = await enableSwitch();
    expect(toggle).toBeChecked();
    await act(async () => fireEvent(toggle, "valueChange", false));

    expect(mockSetEnabled).toHaveBeenCalledWith(false);
    expect(readAlarmPermissions).not.toHaveBeenCalled();
    expect(screen.queryByTestId("pathname")).toBeNull();
  });

  // The stored switch is the user's choice; the shown one, whether it can ring.
  it("reads Off at the default location's times, and On once a city lands", async () => {
    useAlarmSettingsStore.setState({
      [ALARM_TYPE.FAJR]: { ...useAlarmSettingsStore.getState()[ALARM_TYPE.FAJR], enabled: true },
    });
    usePrayerTimesStore.setState({ usingDefaultLocation: true });
    await renderScreen();

    expect(await enableSwitch()).not.toBeChecked();

    await act(async () => usePrayerTimesStore.setState({ usingDefaultLocation: false }));
    expect(await enableSwitch()).toBeChecked();
    expect(useAlarmSettingsStore.getState()[ALARM_TYPE.FAJR].enabled).toBe(true);
  });
});
