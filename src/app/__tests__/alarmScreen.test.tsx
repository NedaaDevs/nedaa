import { act, screen, userEvent } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import { withRepeat } from "react-native-reanimated";
import * as ExpoAlarm from "expo-alarm";

import AlarmTriggeredScreen from "@/app/alarm";
import { COUNTDOWN_PART } from "@/components/ui/countdown";
import { RINGING_PART } from "@/constants/AlarmRinging";
import { OTHER_TIMING, PRAYER_ID } from "@/constants/Prayer";
import {
  EMERGENCY_QUIET_ALLOWANCE,
  EMERGENCY_QUIET_MS,
  EMERGENCY_QUIET_PART,
} from "@/constants/EmergencyQuiet";
import { ScheduledAlarmType } from "@/enums/alarm";
import { WAKE_TASK_ID } from "@/constants/WakeTask";
import { AppLocale } from "@/enums/app";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import i18n from "@/localization/i18n";
import { useAppStore } from "@/stores/app";
import { useEmergencyQuietStore } from "@/stores/emergencyQuiet";
import { usePreferencesStore } from "@/stores/preferences";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { quietControl } from "@/test-helpers/quietControl";
import { renderWithTheme } from "@/test-helpers/theme";
import type { DayPrayerTimes } from "@/types/prayerTimes";
import { deviceTimeZone } from "@/utils/date";
import { NEW_QUIET_LEDGER, recordUse, setAllowance } from "@/utils/emergencyQuiet";
import type { TaskRunSnapshot } from "@/utils/taskRun";

const FIRST_ALARM_ID = "alarm-1";
const SECOND_ALARM_ID = "alarm-2";
let mockAlarmId = FIRST_ALARM_ID;
/** A type no alarm is scheduled with, as a stale or hand-made link carries. */
const UNKNOWN_ALARM_TYPE = "unknown";
let mockAlarmType: string = ScheduledAlarmType.JUMMAH;

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("expo-alarm", () => ({ ...jest.requireActual("expo-alarm") }));
jest.mock("@/hooks/useReducedMotion", () => ({ useReducedMotion: jest.fn(() => false) }));
jest.mock("react-native-safe-area-context", () => ({
  ...jest.requireActual("react-native-safe-area-context"),
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ alarmType: mockAlarmType, alarmId: mockAlarmId }),
  Stack: { Screen: () => null },
}));
// 18:10 on the device clock, whatever zone the device is in.
const EVENING = new Date(2026, 8, 25, 18, 10);
let mockNow = EVENING;
jest.mock("@/hooks/useMinuteClock", () => ({
  useMinuteClock: () => mockNow,
}));
/** The stand-ins' names, which say what the screen handed them. */
const mockLabel = {
  START: "open task",
  SOUNDING: "task, sounding",
  SNOOZED: "task, snoozed",
  RESUMED: "task, resumed",
  SHELL_STOP: "stop from task",
  SOLVE_LAST: "solve the last task",
  START_STOP: "stop, no task",
} as const;
type MockShellProps = {
  onBack: (saved: TaskRunSnapshot) => void;
  onStop: () => void;
  onComplete: () => void;
  audible: boolean;
  resume?: TaskRunSnapshot;
  solved: unknown;
};
type MockStartProps = { onStart: () => void; onStop: () => void; ref?: { current: unknown } };
/** The ref the screen handed the main button's stand-in. */
const mockStart: { ref?: { current: unknown } } = {};
// Stand-ins whose press reaches the screen's wiring.
jest.mock("@/components/alarm/challenges", () => {
  const { createElement, useState } = jest.requireActual("react");
  const { Pressable, Text, View } = jest.requireActual("react-native");
  const press = (label: string, onPress: () => void) =>
    createElement(
      Pressable,
      { accessibilityRole: "button", onPress },
      createElement(Text, null, label)
    );
  const { FIRST_POSITION } = jest.requireActual("@/utils/taskRun");
  const { startTaskClock } = jest.requireActual("@/utils/taskClock");
  const { WAY_OUT_SOUNDING_SECONDS } = jest.requireActual("@/constants/WakeTaskShell");
  const saved = () => ({
    clock: {
      ...startTaskClock(0, 0),
      soundingMs: mockRun.wayOut ? WAY_OUT_SOUNDING_SECONDS * 1000 : 0,
    },
    position: FIRST_POSITION,
    drawn: {},
  });
  const Shell = ({ onBack, onStop, onComplete, audible, resume, solved }: MockShellProps) => {
    const [done, setDone] = useState(false);
    return createElement(
      View,
      null,
      press(resume ? mockLabel.RESUMED : audible ? mockLabel.SOUNDING : mockLabel.SNOOZED, () =>
        onBack(saved())
      ),
      press(mockLabel.SHELL_STOP, onStop),
      press(mockLabel.SOLVE_LAST, () => {
        setDone(true);
        onComplete();
      }),
      done ? solved : null
    );
  };
  return {
    TaskStart: ({ onStart, onStop, ref }: MockStartProps) => {
      mockStart.ref = ref;
      return createElement(
        View,
        null,
        createElement(
          Pressable,
          { accessibilityRole: "button", onPress: onStart, ref },
          createElement(Text, null, mockLabel.START)
        ),
        press(mockLabel.START_STOP, onStop)
      );
    },
    TaskShell: Shell,
  };
});
/** Whether the run Back leaves has shown its way out. */
const mockRun = { wayOut: false };
const QUIET_CONTROL = quietControl();
const mockScreen = {
  handleChallengeComplete: jest.fn(),
  handlePlainStop: jest.fn(),
  handleClose: jest.fn(),
  handleStop: jest.fn(),
  handleSnooze: jest.fn(),
  isSnoozed: false,
  isDismissed: false,
  snoozeEndTime: null as Date | null,
  snoozeTimeRemaining: 0,
  canSnooze: false,
  snoozeEnabled: true,
  remainingSnoozes: 1,
  tasks: [{ id: WAKE_TASK_ID.MATH, steps: 1 }],
  emergency: QUIET_CONTROL,
};
const SNOOZE_MINUTES = 5;
jest.mock("@/hooks/useAlarmScreen", () => ({
  useAlarmScreen: () => ({
    isSnoozed: mockScreen.isSnoozed,
    isDismissed: mockScreen.isDismissed,
    snoozeEndTime: mockScreen.snoozeEndTime,
    snoozeTimeRemaining: mockScreen.snoozeTimeRemaining,
    canSnooze: mockScreen.canSnooze,
    snoozeEnabled: mockScreen.snoozeEnabled,
    snoozeMinutes: SNOOZE_MINUTES,
    remainingSnoozes: mockScreen.remainingSnoozes,
    tasks: mockScreen.tasks,
    handleChallengeComplete: mockScreen.handleChallengeComplete,
    handlePlainStop: mockScreen.handlePlainStop,
    handleClose: mockScreen.handleClose,
    handleStop: mockScreen.handleStop,
    handleSnooze: mockScreen.handleSnooze,
    handleQuietStart: jest.fn(),
    handleQuietEnd: jest.fn(),
    emergency: mockScreen.emergency,
  }),
}));

/** Friday 25 September 2026, Jumuah at 12:10 in the prayer's zone. */
const DAY: DayPrayerTimes = {
  date: 20260925,
  timezone: "UTC",
  timings: {
    [PRAYER_ID.FAJR]: "2026-09-25T04:30:00.000Z",
    [PRAYER_ID.DHUHR]: "2026-09-25T12:10:00.000Z",
    [PRAYER_ID.ASR]: "2026-09-25T15:20:00.000Z",
    [PRAYER_ID.MAGHRIB]: "2026-09-25T18:05:00.000Z",
    [PRAYER_ID.ISHA]: "2026-09-25T19:25:00.000Z",
  },
  otherTimings: {
    [OTHER_TIMING.SUNRISE]: "2026-09-25T05:50:00.000Z",
    [OTHER_TIMING.SUNSET]: "2026-09-25T18:05:00.000Z",
  } as DayPrayerTimes["otherTimings"],
};

// Read in each test, after the screen's language is set.
const t = (key: string, options?: Record<string, unknown>) => i18n.t(key, options);
const ringingAt = (alarm: string, time: string) =>
  t("a11y.alarm.ringingAt", { alarm: t(alarm), time });
const snoozeName = () =>
  t("a11y.join", {
    first: t("alarm.ringing.snooze", { count: SNOOZE_MINUTES }),
    second: t("alarm.ringing.snoozesLeft", { count: mockScreen.remainingSnoozes }),
  });
const quietName = () => t("alarm.quiet.button");

describe("AlarmTriggeredScreen", () => {
  beforeAll(() => act(() => i18n.changeLanguage(AppLocale.AR)));
  afterAll(() => act(() => i18n.changeLanguage(AppLocale.EN)));
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useReducedMotion).mockReturnValue(false);
    mockAlarmType = ScheduledAlarmType.JUMMAH;
    mockAlarmId = FIRST_ALARM_ID;
    mockNow = EVENING;
    mockScreen.isSnoozed = false;
    mockScreen.isDismissed = false;
    mockScreen.snoozeEndTime = null;
    mockScreen.snoozeTimeRemaining = 0;
    mockScreen.canSnooze = false;
    mockScreen.snoozeEnabled = true;
    mockScreen.remainingSnoozes = 1;
    mockScreen.tasks = [{ id: WAKE_TASK_ID.MATH, steps: 1 }];
    mockScreen.emergency = QUIET_CONTROL;
    mockRun.wayOut = false;
    useAppStore.setState({ locale: AppLocale.AR });
    usePreferencesStore.setState({ use24HourTime: false, useWesternNumerals: false });
    usePrayerTimesStore.setState({ todayTimings: DAY, tomorrowTimings: null });
    useEmergencyQuietStore.setState({ ledger: NEW_QUIET_LEDGER });
    // The route opens the screen only for the alarm that is ringing.
    jest.spyOn(ExpoAlarm, "getPendingChallenge").mockImplementation(() =>
      Promise.resolve({
        alarmId: mockAlarmId,
        alarmType: ScheduledAlarmType.JUMMAH,
        title: "",
        timestamp: 0,
      })
    );
  });

  describe("ringing with a task", () => {
    it("heads the screen with the prayer and its time, spoken in words", async () => {
      await renderWithTheme(<AlarmTriggeredScreen />);

      expect(screen.getByText(t("alarm.ringing.prayerAlarm"))).toBeVisible();
      expect(screen.getByText(t("prayerTimes.jumuah"))).toBeVisible();
      expect(screen.getByText("١٢:١٠")).toBeVisible();
      expect(screen.getByText("م")).toBeVisible();
      expect(
        screen.getByRole("header", {
          name: ringingAt("alarm.types.friday", "الثانية عشرة و١٠ دقائق ظهرًا"),
        })
      ).toBeVisible();
    });

    it("offers the task's start, and nothing else", async () => {
      await renderWithTheme(<AlarmTriggeredScreen />);

      expect(screen.getByRole("button", { name: mockLabel.START })).toBeVisible();
    });

    it("moves the reader's focus to the main button once", async () => {
      const focus = jest.spyOn(AccessibilityInfo, "sendAccessibilityEvent").mockClear();
      await renderWithTheme(<AlarmTriggeredScreen />);
      await act(() => usePreferencesStore.setState({ use24HourTime: true }));

      expect(focus).toHaveBeenCalledTimes(1);
      // Compared by identity: deep equality walks the host instance's tree.
      const [node, event] = focus.mock.calls[0];
      expect(node === mockStart.ref?.current && node !== undefined).toBe(true);
      expect(event).toBe("focus");
      focus.mockRestore();
    });

    it("speaks the wall clock as the time now while no prayer times are stored", async () => {
      mockAlarmType = ScheduledAlarmType.FAJR;
      usePrayerTimesStore.setState({ todayTimings: null, tomorrowTimings: null });
      await renderWithTheme(<AlarmTriggeredScreen />);

      expect(screen.getByText(t("prayerTimes.fajr"))).toBeVisible();
      expect(screen.getByText("٦:١٠")).toBeVisible();
      expect(
        screen.getByRole("header", {
          name: t("a11y.alarm.currentTime", { time: "السادسة و١٠ دقائق مساءً" }),
        })
      ).toBeVisible();
    });

    it("breathes the ring around the time", async () => {
      await renderWithTheme(<AlarmTriggeredScreen />);

      expect(screen.getByTestId(RINGING_PART.HALO, { includeHiddenElements: true })).toBeTruthy();
      expect(withRepeat).toHaveBeenCalled();
    });

    it("holds the ring still under Reduce Motion", async () => {
      jest.mocked(useReducedMotion).mockReturnValue(true);
      await renderWithTheme(<AlarmTriggeredScreen />);

      expect(screen.getByTestId(RINGING_PART.HALO, { includeHiddenElements: true })).toBeTruthy();
      expect(withRepeat).not.toHaveBeenCalled();
    });

    // The ringing alarm is announced once per screen, not on every re-render.
    it("announces the alarm once while it stays on screen", async () => {
      // React Native's test setup already mocks it, so earlier tests' calls count.
      const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockClear();
      await renderWithTheme(<AlarmTriggeredScreen />);
      await act(() => usePrayerTimesStore.setState({ tomorrowTimings: DAY }));
      await act(() => usePreferencesStore.setState({ use24HourTime: true }));

      expect(announce).toHaveBeenCalledTimes(1);
      expect(announce).toHaveBeenCalledWith(
        t("a11y.alarm.ringingAnnouncement", { prayer: t("prayerTimes.jumuah") })
      );
      announce.mockRestore();
    });
  });

  describe("an alarm with no prayer", () => {
    beforeEach(() => {
      mockAlarmType = UNKNOWN_ALARM_TYPE;
    });

    // Arabic speech rewrites clock digits, so labels speak the time in words.
    it("shows the wall clock under the alarm's name, spoken as evening", async () => {
      await renderWithTheme(<AlarmTriggeredScreen />);

      expect(screen.queryByText(t("alarm.ringing.prayerAlarm"))).toBeNull();
      expect(screen.getByText(t("alarm.types.custom"))).toBeVisible();
      expect(screen.getByText("٦:١٠")).toBeVisible();
      expect(
        screen.getByRole("header", {
          name: ringingAt("alarm.types.custom", "السادسة و١٠ دقائق مساءً"),
        })
      ).toBeVisible();
    });

    it("announces a ringing alarm, naming no prayer", async () => {
      const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockClear();
      await renderWithTheme(<AlarmTriggeredScreen />);

      expect(announce).toHaveBeenCalledTimes(1);
      expect(announce).toHaveBeenCalledWith(t("a11y.alarm.ringingCustom"));
      announce.mockRestore();
    });

    // Asr ends at sunset, so the clock past the day's sunset reads as evening.
    it("speaks the clock past its day's sunset as evening, before six", async () => {
      mockNow = new Date(2026, 8, 25, 17, 45);
      const sunset = new Date(2026, 8, 25, 17, 40).toISOString();
      usePrayerTimesStore.setState({
        todayTimings: {
          ...DAY,
          timezone: deviceTimeZone(),
          otherTimings: { ...DAY.otherTimings, [OTHER_TIMING.SUNSET]: sunset },
        },
      });
      await renderWithTheme(<AlarmTriggeredScreen />);

      expect(
        screen.getByRole("header", {
          name: ringingAt("alarm.types.custom", "الخامسة و٤٥ دقيقة مساءً"),
        })
      ).toBeVisible();
    });
  });

  describe("an alarm with no task", () => {
    it("stops at its one press, through the plain stop", async () => {
      const user = userEvent.setup();
      mockScreen.tasks = [];
      await renderWithTheme(<AlarmTriggeredScreen />);

      await user.press(screen.getByRole("button", { name: mockLabel.START_STOP }));

      expect(mockScreen.handlePlainStop).toHaveBeenCalledTimes(1);
      expect(mockScreen.handleStop).not.toHaveBeenCalled();
      expect(mockScreen.handleChallengeComplete).not.toHaveBeenCalled();
    });
  });

  describe("snooze", () => {
    it("offers its length and the snoozes left, and snoozes at a press", async () => {
      const user = userEvent.setup();
      mockScreen.canSnooze = true;
      await renderWithTheme(<AlarmTriggeredScreen />);

      expect(screen.getByText(t("alarm.ringing.snooze", { count: SNOOZE_MINUTES }))).toBeVisible();
      expect(screen.getByText(t("alarm.ringing.snoozesLeft", { count: 1 }))).toBeVisible();
      await user.press(screen.getByRole("button", { name: snoozeName() }));

      expect(mockScreen.handleSnooze).toHaveBeenCalledTimes(1);
    });

    it("counts the snoozes left in a full sentence", async () => {
      mockScreen.canSnooze = true;
      mockScreen.remainingSnoozes = 2;
      await renderWithTheme(<AlarmTriggeredScreen />);

      expect(screen.getByText("بقيت غفوتان")).toBeVisible();
    });

    it("keeps its place with a line once the snoozes are used up", async () => {
      mockScreen.remainingSnoozes = 0;
      await renderWithTheme(<AlarmTriggeredScreen />);

      expect(screen.queryByRole("button", { name: snoozeName() })).toBeNull();
      expect(screen.getByTestId(RINGING_PART.SNOOZE_OFF)).toHaveTextContent(
        t("alarm.ringing.snoozeUsedUp")
      );
    });

    it("says snooze is off for an alarm that has none", async () => {
      mockScreen.snoozeEnabled = false;
      await renderWithTheme(<AlarmTriggeredScreen />);

      expect(screen.getByTestId(RINGING_PART.SNOOZE_OFF)).toHaveTextContent(
        t("alarm.ringing.snoozeOff")
      );
    });
  });

  describe("snoozed", () => {
    beforeEach(() => {
      mockScreen.isSnoozed = true;
      mockScreen.snoozeEndTime = new Date(EVENING.getTime() + 5 * 60_000);
      mockScreen.snoozeTimeRemaining = 90;
    });

    it("counts down in the locale's digits and says the minutes left in words", async () => {
      await renderWithTheme(<AlarmTriggeredScreen />);

      expect(screen.getByRole("header", { name: t("alarm.snoozed") })).toBeVisible();
      expect(
        screen.getByLabelText(t("a11y.alarm.countdown", { time: t("common.minute", { count: 2 }) }))
      ).toBeVisible();
      const row = screen.getByTestId(COUNTDOWN_PART.ROW, { includeHiddenElements: true });
      expect(row).toHaveTextContent(/[٠-٩]/);
      expect(row).not.toHaveTextContent(/[0-9]/);
      expect(screen.getByText(t("alarm.untilRingsAgain"))).toBeVisible();
    });

    it("draws no ring and no snooze", async () => {
      await renderWithTheme(<AlarmTriggeredScreen />);

      expect(screen.queryByTestId(RINGING_PART.HALO, { includeHiddenElements: true })).toBeNull();
      expect(screen.queryByTestId(RINGING_PART.SNOOZE_OFF)).toBeNull();
    });
  });

  describe("the task", () => {
    it("opens over the ringing screen, and back returns to it", async () => {
      const user = userEvent.setup();
      await renderWithTheme(<AlarmTriggeredScreen />);

      await user.press(screen.getByRole("button", { name: mockLabel.START }));
      expect(screen.queryByRole("button", { name: mockLabel.START })).toBeNull();

      await user.press(screen.getByRole("button", { name: mockLabel.SOUNDING }));
      expect(screen.getByRole("button", { name: mockLabel.START })).toBeVisible();
    });

    it("hands its stop to the screen's stop, not to its solve", async () => {
      const user = userEvent.setup();
      await renderWithTheme(<AlarmTriggeredScreen />);

      await user.press(screen.getByRole("button", { name: mockLabel.START }));
      await user.press(screen.getByRole("button", { name: mockLabel.SHELL_STOP }));

      expect(mockScreen.handleStop).toHaveBeenCalledTimes(1);
      expect(mockScreen.handleChallengeComplete).not.toHaveBeenCalled();
    });

    it("closes when a snooze starts, and opens silent in the snooze", async () => {
      const user = userEvent.setup();
      const { rerender } = await renderWithTheme(<AlarmTriggeredScreen />);
      await user.press(screen.getByRole("button", { name: mockLabel.START }));

      mockScreen.isSnoozed = true;
      mockScreen.snoozeEndTime = new Date(EVENING.getTime() + 5 * 60_000);
      await rerender(<AlarmTriggeredScreen />);
      expect(screen.queryByRole("button", { name: mockLabel.SOUNDING })).toBeNull();

      await user.press(screen.getByRole("button", { name: mockLabel.START }));
      expect(screen.getByRole("button", { name: mockLabel.SNOOZED })).toBeVisible();
    });

    it("resumes the run Back left when it opens again", async () => {
      const user = userEvent.setup();
      await renderWithTheme(<AlarmTriggeredScreen />);

      await user.press(screen.getByRole("button", { name: mockLabel.START }));
      await user.press(screen.getByRole("button", { name: mockLabel.SOUNDING }));
      await user.press(screen.getByRole("button", { name: mockLabel.START }));

      expect(screen.getByRole("button", { name: mockLabel.RESUMED })).toBeVisible();
    });

    it("closes when the snooze ends, and starts the run afresh", async () => {
      const user = userEvent.setup();
      mockScreen.isSnoozed = true;
      mockScreen.snoozeEndTime = new Date(EVENING.getTime() + 5 * 60_000);
      const { rerender } = await renderWithTheme(<AlarmTriggeredScreen />);
      await user.press(screen.getByRole("button", { name: mockLabel.START }));
      await user.press(screen.getByRole("button", { name: mockLabel.SNOOZED }));
      await user.press(screen.getByRole("button", { name: mockLabel.START }));

      mockScreen.isSnoozed = false;
      mockScreen.snoozeEndTime = null;
      await rerender(<AlarmTriggeredScreen />);
      expect(screen.queryByRole("button", { name: mockLabel.RESUMED })).toBeNull();

      await user.press(screen.getByRole("button", { name: mockLabel.START }));
      expect(screen.getByRole("button", { name: mockLabel.SOUNDING })).toBeVisible();
    });
  });

  describe("the last task solved", () => {
    it("says the alarm stopped and when Jumuah began, and Close leaves", async () => {
      const user = userEvent.setup();
      await renderWithTheme(<AlarmTriggeredScreen />);
      await user.press(screen.getByRole("button", { name: mockLabel.START }));

      await user.press(screen.getByRole("button", { name: mockLabel.SOLVE_LAST }));

      expect(mockScreen.handleChallengeComplete).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("header", { name: t("alarm.solved.title") })).toBeVisible();
      const prayer = t("prayerTimes.jumuah");
      expect(screen.getByText(t("alarm.solved.began", { prayer, time: "١٢:١٠ م" }))).toBeVisible();

      await user.press(screen.getByRole("button", { name: t("common.close") }));
      expect(mockScreen.handleClose).toHaveBeenCalledTimes(1);
    });

    it("leaves nothing of a solved alarm to the next alarm's screen", async () => {
      const user = userEvent.setup();
      const { rerender } = await renderWithTheme(<AlarmTriggeredScreen />);
      await user.press(screen.getByRole("button", { name: mockLabel.START }));
      await user.press(screen.getByRole("button", { name: mockLabel.SOLVE_LAST }));

      mockAlarmId = SECOND_ALARM_ID;
      await rerender(<AlarmTriggeredScreen />);

      expect(await screen.findByRole("button", { name: mockLabel.START })).toBeVisible();
      expect(screen.queryByRole("header", { name: t("alarm.solved.title") })).toBeNull();
    });
  });

  describe("emergency quiet", () => {
    it("is offered under the task's start, and asks to confirm", async () => {
      const user = userEvent.setup();
      await renderWithTheme(<AlarmTriggeredScreen />);

      await user.press(screen.getByRole("button", { name: quietName() }));

      expect(QUIET_CONTROL.open).toHaveBeenCalledTimes(1);
    });

    it("covers snooze with its confirm", async () => {
      mockScreen.canSnooze = true;
      const { rerender } = await renderWithTheme(<AlarmTriggeredScreen />);
      expect(screen.getByRole("button", { name: snoozeName() })).toBeVisible();

      mockScreen.emergency = { ...QUIET_CONTROL, confirming: true };
      await rerender(<AlarmTriggeredScreen />);

      expect(screen.getByTestId(EMERGENCY_QUIET_PART.CONFIRM)).toBeVisible();
      expect(screen.queryByRole("button", { name: snoozeName() })).toBeNull();
    });

    it("gives snooze back once the way out takes the confirm away", async () => {
      const user = userEvent.setup();
      mockScreen.canSnooze = true;
      mockScreen.emergency = { ...QUIET_CONTROL, confirming: true };
      mockRun.wayOut = true;
      await renderWithTheme(<AlarmTriggeredScreen />);

      await user.press(screen.getByRole("button", { name: mockLabel.START }));
      await user.press(screen.getByRole("button", { name: mockLabel.SOUNDING }));

      expect(screen.queryByTestId(EMERGENCY_QUIET_PART.CONFIRM)).toBeNull();
      expect(screen.queryByRole("button", { name: quietName() })).toBeNull();
      expect(screen.getByRole("button", { name: snoozeName() })).toBeVisible();
    });

    it("shows the re-ring while it runs, holds the ring still, and keeps the task silent", async () => {
      const user = userEvent.setup();
      mockScreen.emergency = {
        ...QUIET_CONTROL,
        quietUntil: EVENING.getTime() + EMERGENCY_QUIET_MS,
      };
      await renderWithTheme(<AlarmTriggeredScreen />);
      expect(screen.getByTestId(EMERGENCY_QUIET_PART.BANNER)).toBeVisible();
      expect(screen.queryByTestId(RINGING_PART.SNOOZE_OFF)).toBeNull();
      expect(withRepeat).not.toHaveBeenCalled();

      await user.press(screen.getByRole("button", { name: mockLabel.START }));

      expect(screen.getByRole("button", { name: mockLabel.SNOOZED })).toBeVisible();
    });

    it("says the quiet was used once it has rung again", async () => {
      mockScreen.emergency = { ...QUIET_CONTROL, used: true };
      await renderWithTheme(<AlarmTriggeredScreen />);

      expect(screen.getByTestId(EMERGENCY_QUIET_PART.USED)).toBeVisible();
      expect(screen.queryByRole("button", { name: quietName() })).toBeNull();
    });

    it("says when the next quiet comes once the month's are spent", async () => {
      const one = setAllowance(NEW_QUIET_LEDGER, EMERGENCY_QUIET_ALLOWANCE.ONE, EVENING.getTime());
      useEmergencyQuietStore.setState({ ledger: recordUse(one, EVENING.getTime()) ?? one });
      await renderWithTheme(<AlarmTriggeredScreen />);

      expect(screen.getByTestId(EMERGENCY_QUIET_PART.NONE_LEFT)).toBeVisible();
      expect(screen.queryByRole("button", { name: quietName() })).toBeNull();
    });
  });
});
