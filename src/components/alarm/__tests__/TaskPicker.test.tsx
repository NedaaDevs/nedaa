import { useState } from "react";
import { AccessibilityInfo, Platform } from "react-native";
import { act, fireEvent, screen, userEvent } from "@testing-library/react-native";
import * as ExpoAlarm from "expo-alarm";

import TaskPicker, { type TaskTrialTarget } from "@/components/alarm/TaskPicker";
import { A11Y_ACTION } from "@/constants/Accessibility";
import { ALARM_TYPE } from "@/constants/Alarm";
import {
  WAKE_TASK_ID,
  WAKE_TASK_IDS,
  WAKE_TASK_MAX_STACK,
  WAKE_TASK_MAX_STEPS,
  WAKE_TASK_MOVE,
  WAKE_TASK_STEP_CHOICES,
  type WakeTaskId,
} from "@/constants/WakeTask";
import { TAP_PRESSES } from "@/constants/WakeTaskBoards";
import { TASK_TRIAL_ALL, WAKE_TASK_ABOUT_KEY, WAKE_TASK_NAME_KEY } from "@/constants/WakeTaskShell";
import { ScheduledAlarmType } from "@/enums/alarm";
import { PlatformType } from "@/enums/app";
import { useAlarmTypeSettings } from "@/hooks/useAlarmTypeSettings";
import i18n from "@/localization/i18n";
import { useAlarmSettingsStore } from "@/stores/alarmSettings";
import { renderWithTheme } from "@/test-helpers/theme";
import type { WakeTask } from "@/types/alarm";
import { wayOutSentence } from "@/utils/taskClock";
import {
  addWakeTask,
  changeWakeTask,
  legacyChallengeFromWakeTasks,
  moveWakeTask,
  removeWakeTask,
} from "@/utils/wakeTasks";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("@/hooks/useHaptic", () => ({ useHaptic: () => jest.fn() }));
jest.mock("expo-alarm", () => ({
  ...jest.requireActual("expo-alarm"),
  setAlarmSettings: jest.fn(async () => true),
}));
jest.mock("@/utils/alarmScheduler", () => ({
  scheduleFajrAlarm: jest.fn(),
  scheduleFridayAlarm: jest.fn(),
}));
jest.mock("@/utils/alarmReport", () => ({ alarmLog: { e: jest.fn(), w: jest.fn() } }));
jest.mock("@/stores/alarm", () => ({
  useAlarmStore: {
    getState: () => ({ cancelAlarmsByType: jest.fn(), scheduleAlarm: jest.fn() }),
    persist: {},
  },
}));

const t = i18n.t.bind(i18n);
const { EASY, HARD } = ExpoAlarm.CHALLENGE_DIFFICULTY;
const INITIAL = useAlarmSettingsStore.getState();

const MATH: WakeTask = { id: WAKE_TASK_ID.MATH, difficulty: EASY, steps: 1 };
const TAP: WakeTask = { id: WAKE_TASK_ID.TAP };
const DHIKR: WakeTask = { id: WAKE_TASK_ID.DHIKR, steps: 1 };
const PRAYERS: WakeTask = { id: WAKE_TASK_ID.PRAYERS };

const nameOf = (id: (typeof WAKE_TASK_IDS)[number]) => t(WAKE_TASK_NAME_KEY[id]);
const aboutOf = (id: (typeof WAKE_TASK_IDS)[number]) =>
  t(WAKE_TASK_ABOUT_KEY[id], { count: TAP_PRESSES });
const rowName = (first: string, second: string) => t("a11y.sentences", { first, second });
const NONE = rowName(t("alarm.task.none"), t("alarm.task.about.none"));

/** Holds the stack as the screen would, so each change redraws the picker. */
const Held = ({
  initial,
  onChange,
  onTry,
}: {
  initial: readonly WakeTask[];
  onChange: (tasks: WakeTask[]) => void;
  onTry: (target: TaskTrialTarget) => void;
}) => {
  const [tasks, setTasks] = useState(initial);
  return (
    <TaskPicker
      tasks={tasks}
      onChange={(next) => {
        setTasks(next);
        onChange(next);
      }}
      onTry={onTry}
    />
  );
};

const setUp = async (initial: readonly WakeTask[]) => {
  const onChange = jest.fn();
  const onTry = jest.fn();
  await renderWithTheme(<Held initial={initial} onChange={onChange} onTry={onTry} />);
  return { onChange, onTry, user: userEvent.setup() };
};

const rowOf = (id: (typeof WAKE_TASK_IDS)[number]) => rowName(nameOf(id), aboutOf(id));
const checkbox = (id: (typeof WAKE_TASK_IDS)[number]) =>
  screen.getByRole("checkbox", { name: rowOf(id) });
/** The rows' names, top to bottom. */
const shownOrder = () =>
  screen.getAllByRole("checkbox").map((row) => String(row.props.accessibilityLabel));

describe("TaskPicker", () => {
  it("lists None, then each task once, in the page's order", async () => {
    await setUp([]);

    expect(shownOrder()).toEqual([NONE, ...WAKE_TASK_IDS.map(rowOf)]);
    expect(screen.getByRole("checkbox", { name: NONE })).toBeChecked();
  });

  it("lists the chosen tasks first, in the stack's order", async () => {
    const stack = [PRAYERS, MATH];
    await setUp(stack);
    const ids: WakeTaskId[] = stack.map((task) => task.id);

    expect(shownOrder()).toEqual([
      NONE,
      ...[...ids, ...WAKE_TASK_IDS.filter((id) => !ids.includes(id))].map(rowOf),
    ]);
  });

  it("adds a checked task at the end and removes an unchecked one", async () => {
    const { user, onChange } = await setUp([TAP]);

    await user.press(checkbox(WAKE_TASK_ID.MATH));
    expect(onChange).toHaveBeenLastCalledWith(addWakeTask([TAP], WAKE_TASK_ID.MATH));
    expect(checkbox(WAKE_TASK_ID.MATH)).toBeChecked();

    await user.press(checkbox(WAKE_TASK_ID.TAP));
    expect(onChange).toHaveBeenLastCalledWith(
      removeWakeTask(addWakeTask([TAP], WAKE_TASK_ID.MATH), WAKE_TASK_ID.TAP)
    );
    expect(checkbox(WAKE_TASK_ID.TAP)).not.toBeChecked();
  });

  it("clears the stack with None", async () => {
    const { user, onChange } = await setUp([TAP, MATH]);

    expect(screen.getByRole("checkbox", { name: NONE })).not.toBeChecked();
    await user.press(screen.getByRole("checkbox", { name: NONE }));

    expect(onChange).toHaveBeenLastCalledWith([]);
    expect(screen.getByRole("checkbox", { name: NONE })).toBeChecked();
  });

  it("holds the other tasks still once the stack is full", async () => {
    const { user, onChange } = await setUp([TAP, MATH, DHIKR]);
    const full = t("alarm.task.full", { count: WAKE_TASK_MAX_STACK });
    const pattern = screen.getByRole("checkbox", {
      name: rowName(nameOf(WAKE_TASK_ID.PATTERN), full),
    });

    expect(pattern).toBeDisabled();
    await user.press(pattern);

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getAllByText(full)).toHaveLength(WAKE_TASK_IDS.length - WAKE_TASK_MAX_STACK);
  });

  it("moves a task one place, says where it landed, and stops at the ends", async () => {
    const { user, onChange } = await setUp([TAP, MATH, PRAYERS]);
    const tap = nameOf(WAKE_TASK_ID.TAP);
    const up = screen.getByRole("button", { name: t("a11y.alarm.task.moveUp", { name: tap }) });
    const down = t("a11y.alarm.task.moveDown", { name: tap });
    const focus = jest.spyOn(AccessibilityInfo, "sendAccessibilityEvent");

    expect(up).toBeDisabled();
    await user.press(screen.getByRole("button", { name: down }));

    expect(shownOrder().slice(1, 4)).toEqual(
      [WAKE_TASK_ID.MATH, WAKE_TASK_ID.TAP, WAKE_TASK_ID.PRAYERS].map(rowOf)
    );
    // The row moved under the reader's finger; focus stays on the pressed button.
    expect(focus).toHaveBeenCalledTimes(1);
    expect(focus.mock.lastCall?.[0]).toHaveProperty("props.accessibilityLabel", down);
    expect(focus.mock.lastCall?.[1]).toBe("focus");
    focus.mockRestore();

    expect(onChange).toHaveBeenLastCalledWith(
      moveWakeTask([TAP, MATH, PRAYERS], WAKE_TASK_ID.TAP, WAKE_TASK_MOVE.DOWN)
    );
    const landed = t("a11y.join", {
      first: tap,
      second: t("alarm.task.taskOf", { task: 2, total: 3 }),
    });
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(landed);
    expect(
      screen.getByRole("button", {
        name: t("a11y.alarm.task.moveDown", { name: nameOf(WAKE_TASK_ID.PRAYERS) }),
      })
    ).toBeDisabled();
  });

  it("offers no order buttons for a stack of one", async () => {
    await setUp([MATH]);

    expect(
      screen.queryByRole("button", {
        name: t("a11y.alarm.task.moveUp", { name: nameOf(WAKE_TASK_ID.MATH) }),
      })
    ).toBeNull();
  });

  it("sets a chosen task's difficulty where its board has one", async () => {
    const { user, onChange } = await setUp([MATH, DHIKR]);

    // Dhikr has no difficulty, so Math's is the one choice drawn.
    await user.press(screen.getByRole("radio", { name: t("alarm.challenge.hard") }));

    expect(onChange).toHaveBeenLastCalledWith(
      changeWakeTask([MATH, DHIKR], WAKE_TASK_ID.MATH, { difficulty: HARD })
    );
  });

  it("counts a chosen task's steps, up to the most a board offers", async () => {
    const almost = WAKE_TASK_STEP_CHOICES[WAKE_TASK_STEP_CHOICES.indexOf(WAKE_TASK_MAX_STEPS) - 1];
    const { onChange } = await setUp([{ ...DHIKR, steps: almost }]);
    const steps = screen.getByRole("adjustable", {
      name: t("a11y.join", { first: nameOf(WAKE_TASK_ID.DHIKR), second: t("alarm.task.steps") }),
    });

    await act(() =>
      fireEvent(steps, "accessibilityAction", {
        nativeEvent: { actionName: A11Y_ACTION.INCREMENT },
      })
    );
    expect(onChange).toHaveBeenLastCalledWith([{ ...DHIKR, steps: WAKE_TASK_MAX_STEPS }]);

    onChange.mockClear();
    await act(() =>
      fireEvent(steps, "accessibilityAction", {
        nativeEvent: { actionName: A11Y_ACTION.INCREMENT },
      })
    );
    expect(onChange).not.toHaveBeenCalled();
  });

  it("tries one task from its row, chosen or not; None has no trial", async () => {
    const { user, onTry } = await setUp([TAP]);

    await user.press(
      screen.getByRole("button", {
        name: t("a11y.alarm.task.try", { name: nameOf(WAKE_TASK_ID.PATTERN) }),
      })
    );

    expect(onTry).toHaveBeenCalledWith(WAKE_TASK_ID.PATTERN);
    expect(
      screen.queryByRole("button", {
        name: t("a11y.alarm.task.try", { name: t("alarm.task.none") }),
      })
    ).toBeNull();
  });

  it("tries a stack of two or more in order", async () => {
    const { user, onTry } = await setUp([TAP]);

    expect(screen.queryByRole("button", { name: t("alarm.task.tryAll") })).toBeNull();
    await user.press(checkbox(WAKE_TASK_ID.MATH));
    await user.press(screen.getByRole("button", { name: t("alarm.task.tryAll") }));

    expect(onTry).toHaveBeenCalledWith(TASK_TRIAL_ALL);
  });

  it("says when the way out appears, only while a task is set", async () => {
    await setUp([TAP]);
    const wayOut = wayOutSentence(t);

    expect(screen.getByText(wayOut)).toBeVisible();
    await userEvent.setup().press(screen.getByRole("checkbox", { name: NONE }));
    expect(screen.queryByText(wayOut)).toBeNull();
  });

  // The picker edits `tasks`; the store and Android's overlay must follow it.
  describe("on an alarm's settings", () => {
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

    beforeEach(() => {
      jest.clearAllMocks();
      useAlarmSettingsStore.setState(INITIAL, true);
      jest.replaceProperty(Platform, "OS", PlatformType.ANDROID);
    });

    afterEach(() => jest.restoreAllMocks());

    it("stores each edit and sends Android the challenge the stack maps to", async () => {
      await renderWithTheme(<Wired />);
      const user = userEvent.setup();

      await user.press(checkbox(WAKE_TASK_ID.TAP));
      await user.press(checkbox(WAKE_TASK_ID.PATTERN));
      await user.press(checkbox(WAKE_TASK_ID.MATH));
      await user.press(
        screen.getByRole("button", {
          name: t("a11y.alarm.task.moveUp", { name: nameOf(WAKE_TASK_ID.MATH) }),
        })
      );

      const saved = useAlarmSettingsStore.getState().fajr;
      expect(saved.tasks.map((task) => task.id)).toEqual([WAKE_TASK_ID.MATH, WAKE_TASK_ID.PATTERN]);
      const challenge = legacyChallengeFromWakeTasks(saved.tasks);
      expect(saved.challenge).toEqual(challenge);
      expect(jest.mocked(ExpoAlarm.setAlarmSettings)).toHaveBeenLastCalledWith(
        ScheduledAlarmType.FAJR,
        expect.objectContaining({
          challengeType: challenge.type,
          challengeDifficulty: challenge.difficulty,
          challengeCount: challenge.count,
        })
      );
    });
  });
});
