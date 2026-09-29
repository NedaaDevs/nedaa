import { Text } from "react-native";
import { usePathname } from "expo-router";
import * as ExpoAlarm from "expo-alarm";
import { act, renderHook, screen, userEvent } from "@testing-library/react-native";
import { renderRouter } from "expo-router/testing-library";

import { AlarmDisclosure, useAlarmTypeFor } from "@/components/prayer-detail/AlarmDisclosure";
import {
  ALARM_TIMING_CHOICES,
  ALARM_TIMING_MODE,
  ALARM_TYPE,
  alarmSettingsHref,
} from "@/constants/Alarm";
import { BACK_DESTINATION } from "@/constants/BackDestinations";
import { OTHER_TIMING, PRAYER_ID, PRAYER_IDS, type PrayerId } from "@/constants/Prayer";
import { SOUND_ASSETS } from "@/constants/sounds";
import i18n from "@/localization/i18n";
import { useAlarmSettingsStore } from "@/stores/alarmSettings";
import { useCustomSoundsStore } from "@/stores/customSounds";
import { controlProblems } from "@/test-helpers/controls";
import { ThemeProvider } from "@/test-helpers/theme";
import type { AlarmType, TimingConfig } from "@/types/alarm";
import type { CustomSound } from "@/types/customSound";
import type { DayPrayerTimes } from "@/types/prayerTimes";
import { scheduleFajrAlarm, scheduleFridayAlarm } from "@/utils/alarmScheduler";

jest.mock("expo-alarm", () => ({ setAlarmSettings: jest.fn() }));
jest.mock("@/utils/alarmScheduler", () => ({
  scheduleFajrAlarm: jest.fn(),
  scheduleFridayAlarm: jest.fn(),
}));
jest.mock("@/utils/alarmReport", () => ({ alarmLog: { e: jest.fn() } }));

const mockCancel = jest.fn();
jest.mock("@/stores/alarm", () => ({
  useAlarmStore: { getState: () => ({ cancelAlarmsByType: mockCancel }) },
}));

let mockDay: DayPrayerTimes | null = null;
jest.mock("@/hooks/useShownDay", () => ({
  useShownDay: () => ({ now: new Date(0), day: mockDay, following: null }),
}));

const scheduleFajr = jest.mocked(scheduleFajrAlarm);
const scheduleFriday = jest.mocked(scheduleFridayAlarm);

/** A stored day whose every time is `at`; only Dhuhr's weekday matters here. */
const dayAt = (timezone: string, at: string): DayPrayerTimes => ({
  date: 0,
  timezone,
  timings: {
    [PRAYER_ID.FAJR]: at,
    [PRAYER_ID.DHUHR]: at,
    [PRAYER_ID.ASR]: at,
    [PRAYER_ID.MAGHRIB]: at,
    [PRAYER_ID.ISHA]: at,
  },
  otherTimings: {
    [OTHER_TIMING.SUNRISE]: at,
    [OTHER_TIMING.SUNSET]: at,
    [OTHER_TIMING.IMSAK]: at,
    [OTHER_TIMING.MIDNIGHT]: at,
    [OTHER_TIMING.FIRST_THIRD]: at,
    [OTHER_TIMING.LAST_THIRD]: at,
  },
});

// Friday noon at UTC+14 is still Thursday in UTC.
const KIRITIMATI_FRIDAY_NOON = "2026-07-23T22:00:00.000Z";
const RIYADH_FRIDAY_DHUHR = "2026-07-24T09:10:00.000Z";
const RIYADH_SATURDAY_DHUHR = "2026-07-25T09:10:00.000Z";

const ALARM_ID = "alarm-id";
const INITIAL = useAlarmSettingsStore.getState();
const AT_PRAYER: TimingConfig = { mode: ALARM_TIMING_MODE.AT_PRAYER_TIME, minutesBefore: 0 };
const BEFORE_30: TimingConfig = { mode: ALARM_TIMING_MODE.BEFORE_PRAYER_TIME, minutesBefore: 30 };

const TITLE: Record<AlarmType, string> = {
  [ALARM_TYPE.FAJR]: i18n.t("prayerDetail.alarm.title.fajr"),
  [ALARM_TYPE.FRIDAY]: i18n.t("prayerDetail.alarm.title.friday"),
};

const Pathname = () => <Text testID="pathname">{usePathname()}</Text>;

const renderDisclosure = (prayerId: PrayerId) =>
  renderRouter(
    {
      [BACK_DESTINATION.HOME.route]: () => (
        <>
          <AlarmDisclosure prayerId={prayerId} />
          <Pathname />
        </>
      ),
      "settings/alarm/[type]": () => <Pathname />,
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
  mockCancel.mockResolvedValue(undefined);
  mockDay = dayAt("Asia/Riyadh", RIYADH_FRIDAY_DHUHR);
});

describe("useAlarmTypeFor", () => {
  const typeFor = async (prayerId: PrayerId) =>
    (await renderHook(() => useAlarmTypeFor(prayerId))).result.current;

  it("offers the Fajr alarm for Fajr", async () => {
    mockDay = dayAt("Asia/Riyadh", RIYADH_SATURDAY_DHUHR);
    expect(await typeFor(PRAYER_ID.FAJR)).toBe(ALARM_TYPE.FAJR);
  });

  it("offers the Friday alarm for Dhuhr on a Friday only", async () => {
    expect(await typeFor(PRAYER_ID.DHUHR)).toBe(ALARM_TYPE.FRIDAY);
    mockDay = dayAt("Asia/Riyadh", RIYADH_SATURDAY_DHUHR);
    expect(await typeFor(PRAYER_ID.DHUHR)).toBeNull();
  });

  it("reads Friday in the shown day's own zone", async () => {
    mockDay = dayAt("Pacific/Kiritimati", KIRITIMATI_FRIDAY_NOON);
    expect(await typeFor(PRAYER_ID.DHUHR)).toBe(ALARM_TYPE.FRIDAY);
    mockDay = dayAt("UTC", KIRITIMATI_FRIDAY_NOON);
    expect(await typeFor(PRAYER_ID.DHUHR)).toBeNull();
  });

  it("offers nothing for the other prayers or before the times load", async () => {
    for (const id of PRAYER_IDS.filter((p) => p !== PRAYER_ID.FAJR && p !== PRAYER_ID.DHUHR)) {
      expect(await typeFor(id)).toBeNull();
    }
    mockDay = null;
    expect(await typeFor(PRAYER_ID.FAJR)).toBeNull();
  });
});

describe("AlarmDisclosure", () => {
  it("renders nothing for a prayer without an alarm", async () => {
    await renderDisclosure(PRAYER_ID.ASR);
    expect(screen.queryByRole("switch")).toBeNull();
  });

  it("renders nothing for Dhuhr on a day that is not Friday", async () => {
    mockDay = dayAt("Asia/Riyadh", RIYADH_SATURDAY_DHUHR);
    await renderDisclosure(PRAYER_ID.DHUHR);
    expect(screen.queryByRole("switch")).toBeNull();
  });

  it("shows the Fajr alarm off, with no body", async () => {
    await renderDisclosure(PRAYER_ID.FAJR);

    expect(alarmSwitch(ALARM_TYPE.FAJR).props.accessibilityState).toMatchObject({
      checked: false,
    });
    expect(
      screen.getByRole("switch", {
        name: `${TITLE.fajr}, ${i18n.t("prayerDetail.alarm.summary.off")}`,
      })
    ).toBeTruthy();
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
  });

  it("says the Friday alarm rings only on Fridays", async () => {
    await renderDisclosure(PRAYER_ID.DHUHR);
    expect(
      screen.getByRole("switch", {
        name: `${TITLE.friday}, ${i18n.t("alarm.settings.fridayEnableDescription")}`,
      })
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
    await renderDisclosure(PRAYER_ID.FAJR);

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

  it("switches Fajr to before at the smallest step, and back to zero minutes", async () => {
    const user = userEvent.setup();
    setAlarm(ALARM_TYPE.FAJR, true, AT_PRAYER);
    await renderDisclosure(PRAYER_ID.FAJR);

    await user.press(screen.getByRole("radio", { name: i18n.t("prayerDetail.alarm.mode.before") }));
    const smallest = ALARM_TIMING_CHOICES.fajr.minuteSteps.find((step) => step > 0);
    expect(timingOf(ALARM_TYPE.FAJR)).toEqual({
      mode: ALARM_TIMING_MODE.BEFORE_PRAYER_TIME,
      minutesBefore: smallest,
    });

    await user.press(
      screen.getByRole("radio", { name: i18n.t("prayerDetail.alarm.mode.atPrayer") })
    );
    expect(timingOf(ALARM_TYPE.FAJR)).toEqual(AT_PRAYER);
  });

  it("offers Fajr's steps above zero as pills, and a pill writes its minutes", async () => {
    const user = userEvent.setup();
    setAlarm(ALARM_TYPE.FAJR, true, {
      mode: ALARM_TIMING_MODE.BEFORE_PRAYER_TIME,
      minutesBefore: 15,
    });
    await renderDisclosure(PRAYER_ID.FAJR);

    const pills = screen.getByLabelText(i18n.t("prayerDetail.alarm.minutesBefore"));
    expect(pills).toBeTruthy();
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
    await renderDisclosure(PRAYER_ID.DHUHR);

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
    await renderDisclosure(PRAYER_ID.FAJR);

    await user.press(alarmSwitch(ALARM_TYPE.FAJR));
    expect(
      screen.getByRole("switch", {
        name: `${TITLE.fajr}, ${i18n.t("prayerDetail.alarm.summary.pending")}`,
      })
    ).toBeTruthy();

    await act(async () => schedule.resolve(ALARM_ID));
    expect(useAlarmSettingsStore.getState().fajr.enabled).toBe(true);
    expect(alarmSwitch(ALARM_TYPE.FAJR).props.accessibilityState).toMatchObject({
      checked: true,
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
    await renderDisclosure(PRAYER_ID.FAJR);

    await user.press(alarmSwitch(ALARM_TYPE.FAJR));
    await user.press(alarmSwitch(ALARM_TYPE.FAJR));
    await act(async () => schedule.resolve(ALARM_ID));

    expect(mockCancel).not.toHaveBeenCalled();
    expect(useAlarmSettingsStore.getState().fajr.enabled).toBe(true);
  });

  it("follows the store back off when the schedule fails, and says so", async () => {
    const user = userEvent.setup();
    scheduleFajr.mockResolvedValue(null);
    await renderDisclosure(PRAYER_ID.FAJR);

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
  });

  it("turns the alarm off and cancels it", async () => {
    const user = userEvent.setup();
    setAlarm(ALARM_TYPE.FAJR, true, AT_PRAYER);
    await renderDisclosure(PRAYER_ID.FAJR);

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
    await renderDisclosure(PRAYER_ID.FAJR);

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
    await renderDisclosure(PRAYER_ID.FAJR);

    expect(
      screen.getByLabelText(
        `${i18n.t("prayerDetail.alarm.sound")}, ${i18n.t("alarm.settings.systemSound")}`
      )
    ).toBeTruthy();
  });

  it.each([
    [PRAYER_ID.FAJR, ALARM_TYPE.FAJR],
    [PRAYER_ID.DHUHR, ALARM_TYPE.FRIDAY],
  ] as const)("links %s to its own alarm's full settings", async (prayerId, type) => {
    const user = userEvent.setup();
    setAlarm(type, true, type === ALARM_TYPE.FAJR ? AT_PRAYER : BEFORE_30);
    await renderDisclosure(prayerId);

    await user.press(
      screen.getByRole("button", { name: new RegExp(i18n.t("prayerDetail.alarm.more.title")) })
    );

    expect(screen.getByTestId("pathname")).toHaveTextContent(`/settings/alarm/${type}`);
    expect(alarmSettingsHref(type)).toEqual({
      pathname: "/settings/alarm/[type]",
      params: { type },
    });
  });

  it("gives every control a role, a name and a 44pt target", async () => {
    setAlarm(ALARM_TYPE.FAJR, true, {
      mode: ALARM_TIMING_MODE.BEFORE_PRAYER_TIME,
      minutesBefore: 15,
    });
    await renderDisclosure(PRAYER_ID.FAJR);

    expect(controlProblems()).toEqual([]);
  });
});
