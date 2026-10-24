// First, before expo-router's testing library: that library re-mocks Reanimated
// as it loads, and the group must bind to the mock below, not to its empty one.
import { AlarmDisclosure } from "@/components/prayer-detail/AlarmDisclosure";
import { AccessibilityInfo, Text } from "react-native";
import { usePathname } from "expo-router";
import * as ExpoAlarm from "expo-alarm";
import { act, screen, userEvent } from "@testing-library/react-native";
import { renderRouter, within } from "expo-router/testing-library";

import TimingSettings from "@/components/alarm/TimingSettings";
import { DETAIL_PANEL_ID } from "@/components/prayer-detail/DetailPanel";
import {
  ALARM_PERMISSION,
  ALARM_SETTINGS_ROUTE,
  ALARM_TIMING_CHOICES,
  ALARM_TIMING_MODE,
  ALARM_TYPE,
  alarmSettingsHref,
  timingForMode,
  type AlarmPermissionId,
} from "@/constants/Alarm";
import { BACK_DESTINATION } from "@/constants/BackDestinations";
import { NEDAA_LIGHT } from "@/constants/Palette";
import { SOUND_ASSETS } from "@/constants/sounds";
import { ScheduledAlarmType } from "@/enums/alarm";
import i18n from "@/localization/i18n";
import { useAlarmSettingsStore } from "@/stores/alarmSettings";
import { useCustomSoundsStore } from "@/stores/customSounds";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { controlProblems } from "@/test-helpers/controls";
import { renderWithTheme, ThemeProvider } from "@/test-helpers/theme";
import type { AlarmType, TimingConfig } from "@/types/alarm";
import type { CustomSound } from "@/types/customSound";
import { readAlarmPermissions, type AlarmPermission } from "@/utils/alarmPermissions";
import { scheduleFajrAlarm, scheduleFridayAlarm } from "@/utils/alarmScheduler";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("expo-alarm", () => ({
  ...jest.requireActual("expo-alarm"),
  setAlarmSettings: jest.fn(),
}));
jest.mock("@/utils/alarmScheduler", () => ({
  scheduleFajrAlarm: jest.fn(),
  scheduleFridayAlarm: jest.fn(),
}));
jest.mock("@/utils/alarmReport", () => ({ alarmLog: { e: jest.fn() } }));
jest.mock("@/utils/alarmPermissions", () => ({
  ...jest.requireActual("@/utils/alarmPermissions"),
  readAlarmPermissions: jest.fn(),
}));
jest.mock("@/hooks/useHaptic", () => ({ useHaptic: () => jest.fn() }));

const mockCancel = jest.fn();
/** The alarms the store holds; a test arms one here. */
const mockAlarms: { scheduledAlarms: Record<string, object> } = { scheduledAlarms: {} };
jest.mock("@/stores/alarm", () => {
  const state = () => ({ ...mockAlarms, cancelAlarmsByType: mockCancel });
  const useAlarmStore = (select: (alarms: object) => unknown) => select(state());
  return { useAlarmStore: Object.assign(useAlarmStore, { getState: state }) };
});

const scheduleFajr = jest.mocked(scheduleFajrAlarm);
const scheduleFriday = jest.mocked(scheduleFridayAlarm);
const readPermissions = jest.mocked(readAlarmPermissions);

const {
  NOTIFICATIONS: N,
  EXACT_ALARM: E,
  FULL_SCREEN: F,
  OVERLAY: O,
  BATTERY: B,
} = ALARM_PERMISSION;
/** An Android device's items, these ones still missing. */
const missing = (...ids: AlarmPermissionId[]) =>
  readPermissions.mockResolvedValue(
    [N, E, F, O, B].map((id): AlarmPermission => ({
      id,
      granted: !ids.includes(id),
      canRequestInApp: false,
    }))
  );
const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility");

const ALARM_ID = "alarm-id";
const INITIAL = useAlarmSettingsStore.getState();
const AT_PRAYER: TimingConfig = { mode: ALARM_TIMING_MODE.AT_PRAYER_TIME, minutesBefore: 0 };
const BEFORE_30: TimingConfig = { mode: ALARM_TIMING_MODE.BEFORE_PRAYER_TIME, minutesBefore: 30 };

const TITLE: Record<AlarmType, string> = {
  [ALARM_TYPE.FAJR]: i18n.t("alarm.settings.fajrAlarm"),
  [ALARM_TYPE.FRIDAY]: i18n.t("alarm.settings.fridayAlarm"),
};

const Pathname = () => <Text testID="pathname">{usePathname()}</Text>;

const renderDisclosure = (type: AlarmType) =>
  renderRouter(
    {
      [BACK_DESTINATION.HOME.route]: () => (
        <>
          <AlarmDisclosure type={type} />
          <Pathname />
        </>
      ),
      [BACK_DESTINATION.SETTINGS_ALARM.route]: () => <Pathname />,
      [ALARM_SETTINGS_ROUTE]: () => <Pathname />,
    },
    {
      initialUrl: BACK_DESTINATION.HOME.href as string,
      wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider>,
    }
  );

const setAlarm = (type: AlarmType, enabled: boolean, timing?: TimingConfig) =>
  useAlarmSettingsStore.setState({
    [type]: {
      ...useAlarmSettingsStore.getState()[type],
      enabled,
      ...(timing ? { timing } : {}),
    },
  });

const alarmSwitch = (type: AlarmType) =>
  screen.getByRole("switch", { name: new RegExp(`^${TITLE[type]}`) });
const timingOf = (type: AlarmType) => useAlarmSettingsStore.getState()[type].timing;
const minutes = (count: number) => i18n.t("common.minute", { count });

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
};

beforeEach(() => {
  jest.clearAllMocks();
  useAlarmSettingsStore.setState(INITIAL, true);
  useCustomSoundsStore.setState({ customSounds: [] });
  jest.mocked(ExpoAlarm.setAlarmSettings).mockResolvedValue(true);
  scheduleFajr.mockResolvedValue(ALARM_ID);
  scheduleFriday.mockResolvedValue(ALARM_ID);
  missing();
  usePrayerTimesStore.setState({ usingDefaultLocation: false });
  mockCancel.mockResolvedValue(true);
  mockAlarms.scheduledAlarms = {};
});

describe("AlarmDisclosure", () => {
  it("shows the Fajr alarm off, with no body", async () => {
    await renderDisclosure(ALARM_TYPE.FAJR);

    expect(alarmSwitch(ALARM_TYPE.FAJR).props.accessibilityState).toMatchObject({
      checked: false,
    });
    expect(
      screen.getByRole("switch", {
        name: `${TITLE.fajr}, ${i18n.t("common.off")}`,
      })
    ).toBeTruthy();
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
  });

  it("says the Friday alarm is off while off, and on Fridays only once on", async () => {
    await renderDisclosure(ALARM_TYPE.FRIDAY);
    expect(
      screen.getByRole("switch", { name: `${TITLE.friday}, ${i18n.t("common.off")}` })
    ).toBeTruthy();

    await act(async () => setAlarm(ALARM_TYPE.FRIDAY, true, BEFORE_30));
    expect(
      screen.getByRole("switch", {
        name: `${TITLE.friday}, ${i18n.t("prayerDetail.alarm.summary.fridayBefore", { count: 30 })}`,
      })
    ).toBeTruthy();
  });

  it("offers Fajr at prayer or before, with no minutes while at prayer", async () => {
    setAlarm(ALARM_TYPE.FAJR, true, AT_PRAYER);
    await renderDisclosure(ALARM_TYPE.FAJR);

    const at = screen.getByRole("radio", { name: i18n.t("prayerDetail.alarm.mode.atPrayer") });
    expect(at.props.accessibilityState).toMatchObject({ selected: true });
    expect(
      screen.getByRole("radio", { name: i18n.t("prayerDetail.alarm.mode.before") })
    ).toBeTruthy();
    expect(screen.queryByRole("radio", { name: minutes(5) })).toBeNull();
    expect(
      screen.getByRole("switch", {
        name: `${TITLE.fajr}, ${i18n.t("prayerDetail.alarm.summary.atPrayer")}`,
      })
    ).toBeTruthy();
  });

  it("switches Fajr to before at its default offset, and back to zero minutes", async () => {
    const user = userEvent.setup();
    setAlarm(ALARM_TYPE.FAJR, true, AT_PRAYER);
    await renderDisclosure(ALARM_TYPE.FAJR);

    await user.press(screen.getByRole("radio", { name: i18n.t("prayerDetail.alarm.mode.before") }));
    expect(timingOf(ALARM_TYPE.FAJR)).toEqual(
      timingForMode(ALARM_TYPE.FAJR, ALARM_TIMING_MODE.BEFORE_PRAYER_TIME)
    );

    await user.press(
      screen.getByRole("radio", { name: i18n.t("prayerDetail.alarm.mode.atPrayer") })
    );
    expect(timingOf(ALARM_TYPE.FAJR)).toEqual(AT_PRAYER);
  });

  it("moves Fajr before prayer at the offset the full timing settings choose", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    await renderWithTheme(
      <TimingSettings value={AT_PRAYER} alarmType={ALARM_TYPE.FAJR} onChange={onChange} />
    );
    await user.press(
      screen.getByRole("radio", { name: i18n.t("alarm.settings.beforePrayerTime") })
    );
    const chosenThere: TimingConfig = onChange.mock.calls[0][0];

    setAlarm(ALARM_TYPE.FAJR, true, AT_PRAYER);
    await renderDisclosure(ALARM_TYPE.FAJR);
    await user.press(screen.getByRole("radio", { name: i18n.t("prayerDetail.alarm.mode.before") }));

    expect(timingOf(ALARM_TYPE.FAJR)).toEqual(chosenThere);
  });

  it("keeps the minutes caption from being read before the pills that repeat it", async () => {
    setAlarm(ALARM_TYPE.FAJR, true, BEFORE_30);
    await renderDisclosure(ALARM_TYPE.FAJR);

    const caption = i18n.t("prayerDetail.alarm.minutesBefore");
    expect(screen.queryByText(caption)).toBeNull();
    expect(screen.getByText(caption, { includeHiddenElements: true })).toBeTruthy();
  });

  it("offers Fajr's steps above zero as pills, and a pill writes its minutes", async () => {
    const user = userEvent.setup();
    setAlarm(ALARM_TYPE.FAJR, true, {
      mode: ALARM_TIMING_MODE.BEFORE_PRAYER_TIME,
      minutesBefore: 15,
    });
    await renderDisclosure(ALARM_TYPE.FAJR);

    const pills = screen.getByLabelText(i18n.t("prayerDetail.alarm.minutesBefore"));
    expect(pills).toHaveStyle({ flexWrap: "wrap" });
    for (const step of ALARM_TIMING_CHOICES.fajr.minuteSteps.filter((m) => m > 0)) {
      expect(screen.getByRole("radio", { name: minutes(step) })).toBeTruthy();
    }
    expect(screen.getByRole("radio", { name: minutes(15) }).props.accessibilityState).toMatchObject(
      { selected: true }
    );
    // One pill reads as chosen, never every step up to it.
    expect(screen.getByRole("radio", { name: minutes(10) }).props.accessibilityState).toMatchObject(
      { selected: false }
    );

    await user.press(screen.getByRole("radio", { name: minutes(45) }));
    expect(timingOf(ALARM_TYPE.FAJR)).toEqual({
      mode: ALARM_TIMING_MODE.BEFORE_PRAYER_TIME,
      minutesBefore: 45,
    });
  });

  it("offers Friday only minutes before, from its own steps", async () => {
    const user = userEvent.setup();
    setAlarm(ALARM_TYPE.FRIDAY, true, BEFORE_30);
    await renderDisclosure(ALARM_TYPE.FRIDAY);

    expect(
      screen.queryByRole("radio", { name: i18n.t("prayerDetail.alarm.mode.atPrayer") })
    ).toBeNull();
    for (const step of ALARM_TIMING_CHOICES.friday.minuteSteps) {
      expect(screen.getByRole("radio", { name: minutes(step) })).toBeTruthy();
    }

    await user.press(screen.getByRole("radio", { name: minutes(120) }));
    expect(timingOf(ALARM_TYPE.FRIDAY)).toEqual({
      mode: ALARM_TIMING_MODE.BEFORE_PRAYER_TIME,
      minutesBefore: 120,
    });
  });

  it("shows the alarm scheduling, then on", async () => {
    const user = userEvent.setup();
    const schedule = deferred<string | null>();
    scheduleFajr.mockReturnValue(schedule.promise);
    await renderDisclosure(ALARM_TYPE.FAJR);

    await user.press(alarmSwitch(ALARM_TYPE.FAJR));
    const busy = screen.getByRole("switch", {
      name: `${TITLE.fajr}, ${i18n.t("prayerDetail.alarm.summary.pending")}`,
    });
    expect(busy.props.accessibilityState).toMatchObject({ busy: true, disabled: true });

    await act(async () => schedule.resolve(ALARM_ID));
    expect(useAlarmSettingsStore.getState().fajr.enabled).toBe(true);
    expect(alarmSwitch(ALARM_TYPE.FAJR).props.accessibilityState).toMatchObject({
      checked: true,
      busy: false,
      disabled: false,
    });
    expect(
      screen.getByRole("switch", {
        name: `${TITLE.fajr}, ${i18n.t("prayerDetail.alarm.summary.atPrayer")}`,
      })
    ).toBeTruthy();
  });

  it("ignores a second press while the alarm is scheduling", async () => {
    const user = userEvent.setup();
    const schedule = deferred<string | null>();
    scheduleFajr.mockReturnValue(schedule.promise);
    await renderDisclosure(ALARM_TYPE.FAJR);

    await user.press(alarmSwitch(ALARM_TYPE.FAJR));
    await user.press(alarmSwitch(ALARM_TYPE.FAJR));
    await act(async () => schedule.resolve(ALARM_ID));

    expect(mockCancel).not.toHaveBeenCalled();
    expect(useAlarmSettingsStore.getState().fajr.enabled).toBe(true);
  });

  it("follows the store back off when the schedule fails, and says so", async () => {
    const user = userEvent.setup();
    scheduleFajr.mockResolvedValue(null);
    await renderDisclosure(ALARM_TYPE.FAJR);

    await user.press(alarmSwitch(ALARM_TYPE.FAJR));

    expect(useAlarmSettingsStore.getState().fajr.enabled).toBe(false);
    expect(alarmSwitch(ALARM_TYPE.FAJR).props.accessibilityState).toMatchObject({
      checked: false,
    });
    expect(
      screen.getByRole("switch", {
        name: `${TITLE.fajr}, ${i18n.t("prayerDetail.alarm.summary.failed")}`,
      })
    ).toBeTruthy();
    expect(announce).toHaveBeenCalledWith(i18n.t("prayerDetail.alarm.summary.failed"));
  });

  /** Presses the off switch; the alarm must stay off, at the alarm gate. */
  const expectGate = async () => {
    const user = userEvent.setup();
    await renderDisclosure(ALARM_TYPE.FAJR);

    await user.press(alarmSwitch(ALARM_TYPE.FAJR));

    expect(scheduleFajr).not.toHaveBeenCalled();
    expect(useAlarmSettingsStore.getState().fajr.enabled).toBe(false);
    expect(screen.getByTestId("pathname")).toHaveTextContent(
      BACK_DESTINATION.SETTINGS_ALARM.href as string
    );
  };

  it("opens the alarm gate instead of turning on while a needed item is missing", async () => {
    missing(E, F);
    await expectGate();
  });

  it("opens the alarm gate when the permission read fails", async () => {
    readPermissions.mockRejectedValue(new Error("alarm module down"));
    await expectGate();
  });

  // The alarm would ring at the default location's times, not the user's.
  it("opens the alarm gate at the default location's times, before any read", async () => {
    usePrayerTimesStore.setState({ usingDefaultLocation: true });
    await expectGate();
    expect(readPermissions).not.toHaveBeenCalled();
  });

  it("turns on with an improvement missing, every needed item granted", async () => {
    const user = userEvent.setup();
    missing(F, O, B);
    await renderDisclosure(ALARM_TYPE.FAJR);

    await user.press(alarmSwitch(ALARM_TYPE.FAJR));

    expect(scheduleFajr).toHaveBeenCalledTimes(1);
    expect(useAlarmSettingsStore.getState().fajr.enabled).toBe(true);
  });

  // The stored switch is the user's choice; the shown one, whether it can ring.
  it("reads Off at the default location's times, keeping the stored choice", async () => {
    setAlarm(ALARM_TYPE.FAJR, true, AT_PRAYER);
    usePrayerTimesStore.setState({ usingDefaultLocation: true });
    await renderDisclosure(ALARM_TYPE.FAJR);

    expect(
      screen.getByRole("switch", { name: `${TITLE.fajr}, ${i18n.t("common.off")}` }).props
        .accessibilityState
    ).toMatchObject({ checked: false });
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
    expect(useAlarmSettingsStore.getState().fajr.enabled).toBe(true);
  });

  it("reads On again once a city lands", async () => {
    setAlarm(ALARM_TYPE.FAJR, true, AT_PRAYER);
    usePrayerTimesStore.setState({ usingDefaultLocation: true });
    await renderDisclosure(ALARM_TYPE.FAJR);

    await act(async () => usePrayerTimesStore.setState({ usingDefaultLocation: false }));

    expect(
      screen.getByRole("switch", {
        name: `${TITLE.fajr}, ${i18n.t("prayerDetail.alarm.summary.atPrayer")}`,
      }).props.accessibilityState
    ).toMatchObject({ checked: true });
  });

  // An armed alarm rings whatever the place reads, so it shows On and turns off.
  it("shows an alarm armed at the default location's times On, and turns it off", async () => {
    const user = userEvent.setup();
    setAlarm(ALARM_TYPE.FAJR, true, AT_PRAYER);
    usePrayerTimesStore.setState({ usingDefaultLocation: true });
    mockAlarms.scheduledAlarms = { [ALARM_ID]: { alarmType: ScheduledAlarmType.FAJR } };
    await renderDisclosure(ALARM_TYPE.FAJR);
    expect(alarmSwitch(ALARM_TYPE.FAJR).props.accessibilityState).toMatchObject({
      checked: true,
    });

    await user.press(alarmSwitch(ALARM_TYPE.FAJR));

    expect(mockCancel).toHaveBeenCalledWith(ScheduledAlarmType.FAJR);
    expect(useAlarmSettingsStore.getState().fajr.enabled).toBe(false);
    expect(screen.getByTestId("pathname")).not.toHaveTextContent(
      BACK_DESTINATION.SETTINGS_ALARM.href as string
    );
  });

  it("turns off without asking for permissions", async () => {
    const user = userEvent.setup();
    missing(N);
    setAlarm(ALARM_TYPE.FAJR, true, AT_PRAYER);
    await renderDisclosure(ALARM_TYPE.FAJR);

    await user.press(alarmSwitch(ALARM_TYPE.FAJR));

    expect(readPermissions).not.toHaveBeenCalled();
    expect(useAlarmSettingsStore.getState().fajr.enabled).toBe(false);
  });

  it("turns the alarm off and cancels it", async () => {
    const user = userEvent.setup();
    setAlarm(ALARM_TYPE.FAJR, true, AT_PRAYER);
    await renderDisclosure(ALARM_TYPE.FAJR);

    await user.press(alarmSwitch(ALARM_TYPE.FAJR));

    expect(mockCancel).toHaveBeenCalled();
    expect(useAlarmSettingsStore.getState().fajr.enabled).toBe(false);
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
  });

  it("offers the alarm sounds and custom sounds by their file, and writes the choice", async () => {
    const user = userEvent.setup();
    const sound: CustomSound = {
      id: "custom_1",
      name: "My recording",
      contentUri: "content://media/1",
      fileName: "1.mp3",
      fileSize: 1,
      fileIdentifier: "1",
      availableFor: [],
      dateAdded: "2026-09-29",
    };
    useCustomSoundsStore.setState({ customSounds: [sound] });
    setAlarm(ALARM_TYPE.FAJR, true, AT_PRAYER);
    await renderDisclosure(ALARM_TYPE.FAJR);

    await user.press(
      screen.getByLabelText(
        `${i18n.t("prayerDetail.alarm.sound")}, ${i18n.t(SOUND_ASSETS.beep.label)}`
      )
    );
    await user.press(screen.getByRole("radio", { name: i18n.t(SOUND_ASSETS.takbir.label) }));
    expect(useAlarmSettingsStore.getState().fajr.sound).toBe("takbir");

    await user.press(
      screen.getByLabelText(
        `${i18n.t("prayerDetail.alarm.sound")}, ${i18n.t(SOUND_ASSETS.takbir.label)}`
      )
    );
    expect(screen.queryByRole("radio", { name: i18n.t(SOUND_ASSETS.iqama1.label) })).toBeNull();
    expect(screen.queryByRole("radio", { name: i18n.t(SOUND_ASSETS.silent.label) })).toBeNull();
    await user.press(screen.getByRole("radio", { name: "My recording" }));
    expect(useAlarmSettingsStore.getState().fajr.sound).toBe(sound.contentUri);
  });

  it("names a system sound chosen elsewhere instead of calling it unset", async () => {
    useAlarmSettingsStore.setState({
      fajr: { ...useAlarmSettingsStore.getState().fajr, enabled: true, sound: "iOS-Radar" },
    });
    await renderDisclosure(ALARM_TYPE.FAJR);

    expect(
      screen.getByLabelText(
        `${i18n.t("prayerDetail.alarm.sound")}, ${i18n.t("alarm.settings.systemSound")}`
      )
    ).toBeTruthy();
  });

  it.each(Object.values(ALARM_TYPE))("links %s to its own alarm's full settings", async (type) => {
    const user = userEvent.setup();
    setAlarm(type, true, type === ALARM_TYPE.FAJR ? AT_PRAYER : BEFORE_30);
    await renderDisclosure(type);

    await user.press(
      screen.getByRole("button", { name: new RegExp(i18n.t("prayerDetail.alarm.more.title")) })
    );

    expect(screen.getByTestId("pathname")).toHaveTextContent(
      `${BACK_DESTINATION.SETTINGS_ALARM.href}/${type}`
    );
    expect(alarmSettingsHref(type)).toEqual({
      pathname: `/${ALARM_SETTINGS_ROUTE}`,
      params: { type },
    });
  });

  // The link is one more row of the alarm, not a card nested in the body.
  it("holds the body and a flat settings link in one panel", async () => {
    setAlarm(ALARM_TYPE.FAJR, true, BEFORE_30);
    await renderDisclosure(ALARM_TYPE.FAJR);

    const panel = screen.getByTestId(DETAIL_PANEL_ID);
    expect(panel).not.toHaveStyle({ borderTopWidth: 1 });
    expect(panel).toHaveStyle({ backgroundColor: NEDAA_LIGHT.panel.hex });
    expect(within(panel).getAllByRole("radio").length).toBeGreaterThan(0);
    const link = within(panel).getByRole("button", {
      name: new RegExp(i18n.t("prayerDetail.alarm.more.title")),
    });
    expect(link).not.toHaveStyle({ borderTopWidth: 1 });
  });

  it("draws no panel while the alarm is off", async () => {
    await renderDisclosure(ALARM_TYPE.FAJR);

    expect(screen.queryByTestId(DETAIL_PANEL_ID)).toBeNull();
  });

  it("gives every control a role, a name and a 44pt target", async () => {
    setAlarm(ALARM_TYPE.FAJR, true, {
      mode: ALARM_TIMING_MODE.BEFORE_PRAYER_TIME,
      minutesBefore: 15,
    });
    await renderDisclosure(ALARM_TYPE.FAJR);

    expect(controlProblems()).toEqual([]);
  });
});
