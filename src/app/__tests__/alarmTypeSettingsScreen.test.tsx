// First: expo-router's testing library re-mocks Reanimated as it loads, and the
// screen must bind to the mock below, not to its empty one.
import AlarmTypeSettingsScreen from "@/app/settings/alarm/[type]";
import { AccessibilityInfo, ScrollView, Text } from "react-native";
import { router, Stack, useLocalSearchParams, usePathname } from "expo-router";
import { act, fireEvent } from "@testing-library/react-native";
import { renderRouter, screen, within } from "expo-router/testing-library";

import {
  ALARM_PERMISSION,
  ALARM_SETTINGS_ROUTE,
  ALARM_TYPE,
  PREVIEW_ALARM_SECONDS,
  type AlarmPermissionId,
} from "@/constants/Alarm";
import { ALARM_GUIDE_CARDS, ALARM_TASK_SECTION_TEST_ID } from "@/constants/AlarmGuide";
import { BACK_DESTINATION } from "@/constants/BackDestinations";
import { E2E_ID } from "@/constants/E2E";
import { WAKE_TASK_ID } from "@/constants/WakeTask";
import { TASK_TRIAL_PARAM, TASK_TRIAL_PATH } from "@/constants/WakeTaskShell";
import i18n from "@/localization/i18n";
import { useAlarmStore } from "@/stores/alarm";
import { useAlarmGuideStore } from "@/stores/alarmGuide";
import { useAlarmSettingsStore } from "@/stores/alarmSettings";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { armFajr } from "@/test-helpers/armedAlarm";
import { later } from "@/test-helpers/promises";
import { normalizeRoutePath } from "@/test-helpers/routeTree";
import { ThemeProvider } from "@/test-helpers/theme";
import { readAlarmPermissions, type AlarmPermission } from "@/utils/alarmPermissions";
import { schedulePreviewAlarm } from "@/utils/alarmScheduler";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("@gorhom/bottom-sheet", () => jest.requireActual("@/test-helpers/bottomSheetMock"));
jest.mock("react-native-safe-area-context", () =>
  jest.requireActual("@/test-helpers/safeAreaMock")
);
jest.mock("@/hooks/useHaptic", () => ({ useHaptic: () => jest.fn() }));
// The alarm's own sections have their own tests; here they draw nothing.
jest.mock("@/components/alarm", () => {
  const { createElement } = jest.requireActual("react");
  const { Pressable } = jest.requireActual("react-native");
  const none = () => null;
  return {
    SoundPicker: none,
    VolumeSlider: none,
    // Tries one task, so a test can follow where a trial opens.
    TaskPicker: ({ onTry }: { onTry: (target: string) => void }) =>
      createElement(Pressable, {
        accessibilityRole: "button",
        accessibilityLabel: mockTryLabel,
        onPress: () => onTry(jest.requireActual("@/constants/WakeTask").WAKE_TASK_ID.MATH),
      }),
    GentleWakeUpSettings: none,
    VibrationSettings: none,
    SnoozeSettings: none,
    TimingSettings: none,
  };
});
const mockTryLabel = "try math";
jest.mock("@/utils/alarmScheduler", () => ({
  ...jest.requireActual("@/utils/alarmScheduler"),
  schedulePreviewAlarm: jest.fn(),
}));
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
/** The trial route, showing the params it was opened with. */
const TrialParams = () => {
  const params = useLocalSearchParams();
  return <Text testID="trial">{JSON.stringify(params)}</Text>;
};

// A stack, as in the app, so a pushed screen covers this one instead of replacing it.
const renderScreen = () =>
  renderRouter(
    {
      _layout: () => <Stack screenOptions={{ headerShown: false }} />,
      [ALARM_SETTINGS_ROUTE]: () => <AlarmTypeSettingsScreen />,
      [BACK_DESTINATION.SETTINGS_ALARM.route]: () => <Pathname />,
      [TASK_TRIAL_PATH.slice(1)]: () => <TrialParams />,
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
  // The guide opens by itself on a first visit; these suites are past it.
  useAlarmGuideStore.setState({ hasSeenGuide: true });
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

describe("the alarm's sections", () => {
  const t = i18n.t.bind(i18n);
  const showSections = async () => {
    useAlarmSettingsStore.setState({
      [ALARM_TYPE.FAJR]: { ...useAlarmSettingsStore.getState()[ALARM_TYPE.FAJR], enabled: true },
    });
    armFajr();
    await renderScreen();
  };

  it("titles each section as a header, the wake-up task among them", async () => {
    await showSections();

    expect(await screen.findByRole("header", { name: t("alarm.task.picker") })).toBeVisible();
    expect(screen.getByRole("header", { name: t("alarm.settings.sound") })).toBeVisible();
  });

  it("opens a trial of a task with the alarm's type", async () => {
    await showSections();

    await act(async () =>
      fireEvent.press(await screen.findByRole("button", { name: mockTryLabel }))
    );

    expect(JSON.parse(String(screen.getByTestId("trial").props.children))).toEqual({
      [TASK_TRIAL_PARAM.ALARM_TYPE]: ALARM_TYPE.FAJR,
      [TASK_TRIAL_PARAM.TASK]: WAKE_TASK_ID.MATH,
    });
  });

  it("keeps the preview button's name while it shows a failure", async () => {
    jest.mocked(schedulePreviewAlarm).mockResolvedValueOnce(null);
    await showSections();
    const name = t("a11y.alarm.previewAlarm", { seconds: PREVIEW_ALARM_SECONDS });

    await act(async () => fireEvent.press(await screen.findByRole("button", { name })));

    const button = screen.getByRole("button", { name });
    expect(within(button).getByText(t("alarm.settings.previewAlarmFailed"))).toBeVisible();
  });
});

describe("the alarm guide", () => {
  const t = i18n.t.bind(i18n);
  const total = ALARM_GUIDE_CARDS.length;
  const firstCard = () =>
    t("a11y.sentences", {
      first: t("a11y.alarm.guide.place", { at: 1, total }),
      second: t("alarm.guide.alarm.title"),
    });
  const guideHeading = () => screen.queryByRole("header", { name: firstCard() });
  const press = async (name: string) =>
    act(async () => fireEvent.press(await screen.findByRole("button", { name })));
  const alarmOn = () =>
    useAlarmSettingsStore.setState({
      [ALARM_TYPE.FAJR]: { ...useAlarmSettingsStore.getState()[ALARM_TYPE.FAJR], enabled: true },
    });

  it("opens by itself on a first visit, at its first card", async () => {
    useAlarmGuideStore.setState({ hasSeenGuide: false });
    await renderScreen();

    expect(await screen.findByRole("header", { name: firstCard() })).toBeOnTheScreen();
  });

  it("counts Skip as seen, so it does not open by itself again", async () => {
    useAlarmGuideStore.setState({ hasSeenGuide: false });
    await renderScreen();

    await press(t("alarm.guide.skip"));

    expect(guideHeading()).toBeNull();
    expect(useAlarmGuideStore.getState().hasSeenGuide).toBe(true);
  });

  it("stays closed once seen", async () => {
    await renderScreen();

    expect(await screen.findByRole("button", { name: t("alarm.guide.row") })).toBeOnTheScreen();
    expect(guideHeading()).toBeNull();
  });

  it("opens again from its row, at the first card, with the alarm off", async () => {
    await renderScreen();

    await press(t("alarm.guide.row"));
    await press(t("alarm.guide.next"));
    await press(t("alarm.guide.skip"));
    await press(t("alarm.guide.row"));

    expect(guideHeading()).toBeOnTheScreen();
  });

  it("names where its row leads", async () => {
    await renderScreen();

    expect(await screen.findByRole("button", { name: t("alarm.guide.row") })).toHaveProp(
      "accessibilityHint",
      t("a11y.alarm.guide.rowHint")
    );
  });

  // The alarm screen and the trial are pushed over this one.
  it("closes, as seen, when a screen opens over it", async () => {
    useAlarmGuideStore.setState({ hasSeenGuide: false });
    await renderScreen();
    expect(await screen.findByRole("header", { name: firstCard() })).toBeOnTheScreen();

    await act(async () => router.push(TASK_TRIAL_PATH));

    expect(screen.queryByRole("header", { name: firstCard(), hidden: true })).toBeNull();
    expect(useAlarmGuideStore.getState().hasSeenGuide).toBe(true);
  });

  it("closes from its last card onto the wake-up task section", async () => {
    const SECTION_Y = 640;
    const scrollTo = jest.spyOn(ScrollView.prototype, "scrollTo");
    const focus = jest.spyOn(AccessibilityInfo, "sendAccessibilityEvent");
    alarmOn();
    armFajr();
    await renderScreen();
    await fireEvent(screen.getByTestId(ALARM_TASK_SECTION_TEST_ID), "layout", {
      nativeEvent: { layout: { x: 0, y: SECTION_Y, width: 390, height: 400 } },
    });

    await press(t("alarm.guide.row"));
    for (let card = 1; card < total; card += 1) await press(t("alarm.guide.next"));
    focus.mockClear();
    await press(t("alarm.guide.tryTask"));

    expect(guideHeading()).toBeNull();
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ y: SECTION_Y }));
    expect(screen.getByRole("header", { name: t("alarm.task.picker") })).toBeVisible();
    // The mocked Text's instance, read by its props; a full diff would hang.
    const [target, event] = focus.mock.lastCall ?? [];
    const props: unknown = target ? Reflect.get(target, "props") : undefined;
    expect(props).toMatchObject({ accessibilityRole: "header", children: t("alarm.task.picker") });
    expect(event).toBe("focus");
    scrollTo.mockRestore();
    focus.mockRestore();
  });

  it("can be skipped by a flow that does not read it", async () => {
    useAlarmGuideStore.setState({ hasSeenGuide: false });
    await renderScreen();

    await fireEvent.press(await screen.findByTestId(E2E_ID.ALARM_GUIDE_SKIP));

    expect(guideHeading()).toBeNull();
  });

  it("offers no task to try while the alarm is off", async () => {
    await renderScreen();

    await press(t("alarm.guide.row"));
    for (let card = 1; card < total; card += 1) await press(t("alarm.guide.next"));

    expect(screen.queryByRole("button", { name: t("alarm.guide.tryTask") })).toBeNull();
    expect(screen.getByRole("button", { name: t("alarm.guide.done") })).toBeOnTheScreen();
  });
});
