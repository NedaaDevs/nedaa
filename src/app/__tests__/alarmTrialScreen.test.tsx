import { existsSync } from "fs";
import { join } from "path";
import { Platform } from "react-native";
import { act, cleanup, screen, userEvent } from "@testing-library/react-native";
import Storage from "expo-sqlite/kv-store";
import { router } from "expo-router";
import { CHALLENGE_DIFFICULTY } from "expo-alarm";

import AlarmTrialRoute from "@/app/alarm-trial";
import TaskPicker from "@/components/alarm/TaskPicker";
import { ALARM_TYPE, alarmSettingsHref, isAlarmScreenPath } from "@/constants/Alarm";
import { WAKE_TASK_ID, WAKE_TASK_MAX_STACK, type WakeTaskId } from "@/constants/WakeTask";
import {
  HANDOVER_MS,
  TASK_SHELL_PART,
  TASK_TRIAL_ALL,
  TASK_TRIAL_PARAM,
  TASK_TRIAL_PATH,
  WAKE_TASK_ABOUT_KEY,
  WAKE_TASK_DIFFICULTY_KEY,
  WAKE_TASK_NAME_KEY,
} from "@/constants/WakeTaskShell";
import { TAP_PRESSES } from "@/constants/WakeTaskBoards";
import { PlatformType } from "@/enums/app";
import { useAlarmScreen } from "@/hooks/useAlarmScreen";
import { useAlarmTypeSettings } from "@/hooks/useAlarmTypeSettings";
import i18n from "@/localization/i18n";
import { useAlarmStore } from "@/stores/alarm";
import { useAlarmSettingsStore } from "@/stores/alarmSettings";
import { useAlarmStreakStore } from "@/stores/alarmStreak";
import { nativeCalls, resetNativeLog } from "@/test-helpers/expoAlarmLog";
import { holdHydration } from "@/test-helpers/hydration";
import { REPO_ROOT } from "@/test-helpers/routeTree";
import { renderWithTheme } from "@/test-helpers/theme";
import type { WakeTask } from "@/types/alarm";
import { addWakeTask, wakeTaskFor } from "@/utils/wakeTasks";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("@/hooks/useHaptic", () => ({ useHaptic: () => jest.fn() }));
// Every native call is logged, so a test can show a trial makes none.
jest.mock("expo-alarm", () => jest.requireActual("@/test-helpers/expoAlarmLog").expoAlarmLogModule);
jest.mock("@/hooks/useAlarmScreen", () => ({ useAlarmScreen: jest.fn() }));
jest.mock("react-native-safe-area-context", () => ({
  ...jest.requireActual("react-native-safe-area-context"),
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
const mockParams: Record<string, string> = {};
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => mockParams,
  router: { back: jest.fn(), canGoBack: jest.fn(() => true), replace: jest.fn() },
  Stack: { Screen: () => null },
}));
jest.mock("@/utils/alarmScheduler", () => ({
  scheduleFajrAlarm: jest.fn(),
  scheduleFridayAlarm: jest.fn(),
}));

// Each board solves at one press; the boards' own tests cover their play.
jest.mock("@/components/alarm/challenges/MathBoard", () =>
  jest
    .requireActual("@/test-helpers/taskBoardMock")
    .mockBoard(jest.requireActual("@/constants/WakeTask").WAKE_TASK_ID.MATH)
);
jest.mock("@/components/alarm/challenges/DhikrChallenge", () =>
  jest
    .requireActual("@/test-helpers/taskBoardMock")
    .mockBoard(jest.requireActual("@/constants/WakeTask").WAKE_TASK_ID.DHIKR)
);
jest.mock("@/components/alarm/challenges/TapBoard", () =>
  jest
    .requireActual("@/test-helpers/taskBoardMock")
    .mockBoard(jest.requireActual("@/constants/WakeTask").WAKE_TASK_ID.TAP)
);
jest.mock("@/components/alarm/challenges/PrayersBoard", () =>
  jest
    .requireActual("@/test-helpers/taskBoardMock")
    .mockBoard(jest.requireActual("@/constants/WakeTask").WAKE_TASK_ID.PRAYERS)
);
jest.mock("@/components/alarm/challenges/PatternBoard", () =>
  jest
    .requireActual("@/test-helpers/taskBoardMock")
    .mockBoard(jest.requireActual("@/constants/WakeTask").WAKE_TASK_ID.PATTERN)
);

const t = i18n.t.bind(i18n);
const DONE = t("alarm.task.trial.done");
const LIST = t("alarm.task.trial.backToList");
const USE = t("alarm.task.trial.use");
const HANDOVER_HOLD_MS = HANDOVER_MS.IN + HANDOVER_MS.HOLD;

const MATH: WakeTask = { id: WAKE_TASK_ID.MATH, difficulty: CHALLENGE_DIFFICULTY.HARD, steps: 1 };
const TAP: WakeTask = { id: WAKE_TASK_ID.TAP };
const DHIKR: WakeTask = { id: WAKE_TASK_ID.DHIKR, steps: 1 };

const saveStack = (tasks: WakeTask[]) =>
  useAlarmSettingsStore.setState({
    [ALARM_TYPE.FAJR]: { ...useAlarmSettingsStore.getState()[ALARM_TYPE.FAJR], tasks },
  });

const open = async (task: string) => {
  mockParams[TASK_TRIAL_PARAM.ALARM_TYPE] = ALARM_TYPE.FAJR;
  mockParams[TASK_TRIAL_PARAM.TASK] = task;
  await renderWithTheme(<AlarmTrialRoute />);
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  const solve = (name: string) => user.press(screen.getByRole("button", { name: `solve ${name}` }));
  return { user, solve };
};

/** What any write to an alarm, its outcome or its streak would replace. */
const records = () => ({
  settings: useAlarmSettingsStore.getState(),
  alarms: useAlarmStore.getState(),
  streak: useAlarmStreakStore.getState(),
});

describe("AlarmTrialRoute", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    resetNativeLog();
    saveStack([TAP, MATH]);
    // Saving the stack above writes; only the trial's own writes count.
    jest.mocked(Storage.setItem).mockClear();
  });
  // Unmounted on fake timers; the finished screen's unmount hangs on real ones.
  afterEach(async () => {
    await cleanup();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("is no alarm screen, and its path is a route", () => {
    expect(isAlarmScreenPath(TASK_TRIAL_PATH)).toBe(false);
    expect(existsSync(join(REPO_ROOT, "src", "app", `${TASK_TRIAL_PATH}.tsx`))).toBe(true);
  });

  it("runs the one task its link names, then finishes with a way back", async () => {
    const { user, solve } = await open(WAKE_TASK_ID.MATH);

    expect(screen.getByTestId(TASK_SHELL_PART.TRIAL_STRIP)).toBeVisible();
    expect(screen.queryByRole("button", { name: "solve tap" })).toBeNull();
    await solve(WAKE_TASK_ID.MATH);

    expect(screen.getByRole("header", { name: DONE })).toBeVisible();
    await user.press(screen.getByRole("button", { name: LIST }));
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it("runs the saved stack in order for Try all", async () => {
    const { solve } = await open(TASK_TRIAL_ALL);
    await solve(WAKE_TASK_ID.TAP);
    await act(() => jest.advanceTimersByTime(HANDOVER_HOLD_MS));
    await solve(WAKE_TASK_ID.MATH);

    expect(screen.getByRole("header", { name: DONE })).toBeVisible();
  });

  it("tries a task the alarm does not hold", async () => {
    const { solve } = await open(WAKE_TASK_ID.PATTERN);

    await solve(WAKE_TASK_ID.PATTERN);

    expect(screen.getByRole("header", { name: DONE })).toBeVisible();
  });

  it("leaves to the list mid-run", async () => {
    const { user } = await open(TASK_TRIAL_ALL);

    await user.press(screen.getByRole("button", { name: LIST }));

    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it("offers only the way back for a task it does not know", async () => {
    await open("unknown");

    expect(screen.queryByRole("header", { name: DONE })).toBeNull();
    expect(screen.getByRole("button", { name: LIST })).toBeVisible();
  });

  it("leaves a cold link to the alarm's settings, with no screen to go back to", async () => {
    jest.mocked(router.canGoBack).mockReturnValueOnce(false);
    const { user } = await open(WAKE_TASK_ID.MATH);

    await user.press(screen.getByRole("button", { name: LIST }));

    expect(router.back).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith(alarmSettingsHref(ALARM_TYPE.FAJR));
  });

  it("waits for the saved stack before it runs", async () => {
    const held = holdHydration(useAlarmSettingsStore);
    await open(TASK_TRIAL_ALL);
    expect(screen.queryByTestId(TASK_SHELL_PART.TRIAL_STRIP)).toBeNull();

    saveStack([wakeTaskFor([], WAKE_TASK_ID.PATTERN)]);
    await act(() => held.land());

    expect(screen.getByRole("button", { name: "solve pattern" })).toBeVisible();
    held.restore();
  });

  it("names the task and the options it just ran", async () => {
    const { solve } = await open(WAKE_TASK_ID.MATH);
    await solve(WAKE_TASK_ID.MATH);

    const named = t("alarm.task.withSteps", {
      name: t("alarm.task.withDifficulty", {
        name: t(WAKE_TASK_NAME_KEY[WAKE_TASK_ID.MATH]),
        difficulty: t(WAKE_TASK_DIFFICULTY_KEY[CHALLENGE_DIFFICULTY.HARD]),
      }),
      count: MATH.steps,
    });
    expect(screen.getByText(named)).toBeVisible();
  });

  it.each<{ case: string; stack: WakeTask[]; task: WakeTaskId | typeof TASK_TRIAL_ALL }>([
    { case: "a task the alarm holds", stack: [TAP, MATH], task: WAKE_TASK_ID.MATH },
    { case: "a full stack", stack: [TAP, MATH, DHIKR], task: WAKE_TASK_ID.PATTERN },
    { case: "the whole stack", stack: [TAP], task: TASK_TRIAL_ALL },
  ])("offers only the way back after $case", async ({ stack, task }) => {
    expect(stack.length).toBeLessThanOrEqual(WAKE_TASK_MAX_STACK);
    saveStack(stack);
    const { solve } = await open(task);
    await solve(task === TASK_TRIAL_ALL ? WAKE_TASK_ID.TAP : task);

    expect(screen.getByRole("header", { name: DONE })).toBeVisible();
    expect(screen.queryByRole("button", { name: USE })).toBeNull();
    expect(screen.getByRole("button", { name: LIST })).toBeVisible();
  });

  // The press is the person's choice; until then the trial changes nothing.
  it("adds the tried task only when asked, as the picker's add does", async () => {
    jest.replaceProperty(Platform, "OS", PlatformType.ANDROID);
    const before = records();
    const { user, solve } = await open(WAKE_TASK_ID.PATTERN);
    await solve(WAKE_TASK_ID.PATTERN);

    expect(nativeCalls).toEqual([]);
    expect(records().settings).toBe(before.settings);
    await user.press(screen.getByRole("button", { name: USE }));

    const byTrial = { saved: useAlarmSettingsStore.getState().fajr, native: [...nativeCalls] };
    expect(byTrial.saved.tasks).toEqual(addWakeTask([TAP, MATH], WAKE_TASK_ID.PATTERN));
    expect(router.back).toHaveBeenCalledTimes(1);

    await cleanup();
    useAlarmSettingsStore.setState(before.settings, true);
    resetNativeLog();
    const Wired = () => {
      const { settings, update } = useAlarmTypeSettings(ALARM_TYPE.FAJR);
      return (
        <TaskPicker
          tasks={settings.tasks}
          onChange={(tasks) => update({ tasks })}
          onTry={jest.fn()}
        />
      );
    };
    await renderWithTheme(<Wired />);
    const pattern = t(WAKE_TASK_NAME_KEY[WAKE_TASK_ID.PATTERN]);
    await user.press(
      screen.getByRole("checkbox", {
        name: t("a11y.sentences", {
          first: pattern,
          second: t(WAKE_TASK_ABOUT_KEY[WAKE_TASK_ID.PATTERN], { count: TAP_PRESSES }),
        }),
      })
    );

    expect(useAlarmSettingsStore.getState().fajr).toEqual(byTrial.saved);
    expect(nativeCalls).toEqual(byTrial.native);
  });

  it("calls no alarm native function and writes no alarm, outcome or streak", async () => {
    const before = records();
    const { user, solve } = await open(TASK_TRIAL_ALL);

    await solve(WAKE_TASK_ID.TAP);
    await act(() => jest.advanceTimersByTime(HANDOVER_HOLD_MS));
    await solve(WAKE_TASK_ID.MATH);
    await user.press(screen.getByRole("button", { name: LIST }));

    expect(nativeCalls).toEqual([]);
    expect(records()).toEqual(before);
    expect(records().settings).toBe(before.settings);
    expect(records().alarms).toBe(before.alarms);
    expect(records().streak).toBe(before.streak);
    expect(Storage.setItem).not.toHaveBeenCalled();
    expect(useAlarmScreen).not.toHaveBeenCalled();
  });
});
