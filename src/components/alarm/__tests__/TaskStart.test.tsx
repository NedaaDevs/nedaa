import { screen, userEvent } from "@testing-library/react-native";
import { CHALLENGE_DIFFICULTY } from "expo-alarm";

import TaskStart from "@/components/alarm/challenges/TaskStart";
import { WAKE_TASK_ID } from "@/constants/WakeTask";
import i18n from "@/localization/i18n";
import { renderWithTheme } from "@/test-helpers/theme";
import type { WakeTask } from "@/types/alarm";

jest.mock("@/hooks/useHaptic", () => ({ useHaptic: () => jest.fn() }));

const t = i18n.t.bind(i18n);
const MATH_3: WakeTask = { id: WAKE_TASK_ID.MATH, difficulty: CHALLENGE_DIFFICULTY.EASY, steps: 3 };
const TAP: WakeTask = { id: WAKE_TASK_ID.TAP };
const DHIKR: WakeTask = { id: WAKE_TASK_ID.DHIKR, steps: 1 };

const setUp = async (tasks: readonly WakeTask[]) => {
  const onStart = jest.fn();
  const onStop = jest.fn();
  await renderWithTheme(<TaskStart tasks={tasks} onStart={onStart} onStop={onStop} />);
  return { onStart, onStop, user: userEvent.setup() };
};

describe("TaskStart", () => {
  it("opens the task, naming what it asks for", async () => {
    const { user, onStart, onStop } = await setUp([MATH_3]);
    const name = t("a11y.alarm.task.start", {
      action: t("alarm.task.start"),
      tasks: t("a11y.alarm.task.withSteps", { name: t("alarm.task.name.math"), count: 3 }),
    });

    expect(screen.getByText(t("alarm.task.startHint"))).toBeVisible();
    await user.press(screen.getByRole("button", { name }));

    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onStop).not.toHaveBeenCalled();
  });

  it("names a stack of three by its count alone", async () => {
    const { user, onStart } = await setUp([MATH_3, TAP, DHIKR]);
    const title = t("alarm.task.startCount", { count: 3 });

    expect(screen.queryByText(t("alarm.task.start"))).toBeNull();
    await user.press(screen.getByRole("button", { name: title }));

    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("stops the alarm at once when no task is set", async () => {
    const { user, onStart, onStop } = await setUp([]);

    expect(screen.queryByText(t("alarm.task.startHint"))).toBeNull();
    await user.press(screen.getByRole("button", { name: t("alarm.task.stop") }));

    expect(onStop).toHaveBeenCalledTimes(1);
    expect(onStart).not.toHaveBeenCalled();
  });
});
