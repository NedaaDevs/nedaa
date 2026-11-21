import { AccessibilityInfo, Platform } from "react-native";
import { act, screen, userEvent } from "@testing-library/react-native";
import { CHALLENGE_DIFFICULTY } from "expo-alarm";

import TaskShell from "@/components/alarm/challenges/TaskShell";
import { WAKE_TASK_ID } from "@/constants/WakeTask";
import {
  HANDOVER_MS,
  QUIET_ENDING_SECONDS,
  QUIET_TIME_SECONDS,
  TASK_SHELL_PART,
  WAY_OUT_SOUNDING_SECONDS,
} from "@/constants/WakeTaskShell";
import { AppLocale, PlatformType } from "@/enums/app";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useScreenReader } from "@/hooks/useScreenReader";
import i18n from "@/localization/i18n";
import { useAppStore } from "@/stores/app";
import { usePreferencesStore } from "@/stores/preferences";
import { layOut } from "@/test-helpers/layout";
import { styleOf, type HostElement } from "@/test-helpers/text";
import { renderWithTheme } from "@/test-helpers/theme";
import type { WakeTask } from "@/types/alarm";
import type { NonEmptyTasks, TaskRunSnapshot } from "@/utils/taskRun";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
const mockHaptic = jest.fn();
jest.mock("@/hooks/useHaptic", () => ({ useHaptic: () => mockHaptic }));
jest.mock("@/hooks/useScreenReader", () => ({ useScreenReader: jest.fn(() => false) }));
jest.mock("@/hooks/useReducedMotion", () => ({ useReducedMotion: jest.fn(() => false) }));

// Each board solves at one press; the boards' own tests cover their play.
jest.mock("@/components/alarm/challenges/MathBoard", () =>
  jest.requireActual("@/test-helpers/taskBoardMock").mockBoard("math")
);
jest.mock("@/components/alarm/challenges/DhikrChallenge", () =>
  jest.requireActual("@/test-helpers/taskBoardMock").mockBoard("dhikr")
);
jest.mock("@/components/alarm/challenges/TapBoard", () =>
  jest.requireActual("@/test-helpers/taskBoardMock").mockBoard("tap")
);
jest.mock("@/components/alarm/challenges/PrayersBoard", () =>
  jest.requireActual("@/test-helpers/taskBoardMock").mockBoard("prayers")
);
jest.mock("@/components/alarm/challenges/PatternBoard", () =>
  jest.requireActual("@/test-helpers/taskBoardMock").mockBoard("pattern")
);

const t = i18n.t.bind(i18n);
const SECOND = 1000;
const QUIET_MS = QUIET_TIME_SECONDS.DEFAULT * SECOND;
const ENDING_MS = QUIET_ENDING_SECONDS * SECOND;
const HANDOVER_HOLD_MS = HANDOVER_MS.IN + HANDOVER_MS.HOLD;

const MATH_3: WakeTask = { id: WAKE_TASK_ID.MATH, difficulty: CHALLENGE_DIFFICULTY.EASY, steps: 3 };
const DHIKR_1: WakeTask = { id: WAKE_TASK_ID.DHIKR, steps: 1 };
const TAP: WakeTask = { id: WAKE_TASK_ID.TAP };
const PRAYERS: WakeTask = { id: WAKE_TASK_ID.PRAYERS };
const PATTERN_2: WakeTask = {
  id: WAKE_TASK_ID.PATTERN,
  difficulty: CHALLENGE_DIFFICULTY.EASY,
  steps: 2,
};

const PAUSED = t("alarm.task.quiet.paused");
const ENDING = t("alarm.task.quiet.ending", { count: QUIET_ENDING_SECONDS });
const SOUND_ON = t("alarm.task.quiet.on");
const STOP = t("alarm.task.stop");
const BACK = t("a11y.backTo", { screen: t("alarm.task.back") });

const said = () => jest.mocked(AccessibilityInfo.announceForAccessibility).mock.calls.flat();
const advance = (ms: number) => act(() => jest.advanceTimersByTime(ms));

// accessibilityLiveRegion says "none" for not live; aria-live says "off".
const LIVE = ["polite", "assertive"];

/** The nearest element, from this one outward, that is a live region. */
const liveRegionOf = (element: HostElement): HostElement | null => {
  for (let node: HostElement | null = element; node; node = node.parent) {
    if (LIVE.includes(node.props.accessibilityLiveRegion ?? node.props["aria-live"])) return node;
  }
  return null;
};

const setUp = async (
  tasks: NonEmptyTasks,
  { audible = true, resume }: { audible?: boolean; resume?: TaskRunSnapshot } = {}
) => {
  const callbacks = {
    onComplete: jest.fn(),
    onBack: jest.fn<void, [TaskRunSnapshot]>(),
    onQuietStart: jest.fn(),
    onQuietEnd: jest.fn(),
  };
  const view = await renderWithTheme(
    <TaskShell
      tasks={tasks}
      openedAt={Date.now()}
      resume={resume}
      audible={audible}
      {...callbacks}
    />
  );
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  const solve = (name: string) => user.press(screen.getByRole("button", { name: `solve ${name}` }));
  const back = () => user.press(screen.getByRole("button", { name: BACK }));
  return { ...callbacks, ...view, user, solve, back };
};

const PLATFORM = Platform.OS;

describe("TaskShell", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    jest.mocked(useScreenReader).mockReturnValue(false);
    jest.mocked(useReducedMotion).mockReturnValue(false);
  });
  afterEach(() => {
    jest.useRealTimers();
    Platform.OS = PLATFORM;
  });

  describe("steps", () => {
    it("runs a task's board as many times as its steps", async () => {
      const { solve, onComplete } = await setUp([MATH_3]);
      expect(screen.getByText(t("alarm.task.stepOf", { step: 1, total: 3 }))).toBeVisible();

      await solve("math");
      expect(screen.getByText(t("alarm.task.stepOf", { step: 2, total: 3 }))).toBeVisible();
      await solve("math");
      expect(onComplete).not.toHaveBeenCalled();

      await solve("math");
      expect(onComplete).toHaveBeenCalledTimes(1);
    });

    it("runs the prayers board under its name", async () => {
      const { solve, onComplete } = await setUp([PRAYERS]);
      expect(screen.getByText(t("alarm.task.name.prayers"))).toBeVisible();

      await solve("prayers");
      expect(onComplete).toHaveBeenCalledTimes(1);
    });

    it("says each new step", async () => {
      const { solve } = await setUp([MATH_3]);
      await solve("math");

      expect(said()).toContain(t("alarm.task.stepOf", { step: 2, total: 3 }));
      expect(screen.queryByText(/opens:/)).toBeNull();
    });

    it("hands a new step's line to a board that says it, and does not say it too", async () => {
      const step2 = t("alarm.task.stepOf", { step: 2, total: 2 });
      const { solve } = await setUp([PATTERN_2]);
      expect(screen.queryByText(/opens:/)).toBeNull();

      await solve("pattern");

      expect(screen.getByText(`pattern opens: ${step2}`)).toBeVisible();
      expect(said()).not.toContain(step2);
    });

    it("draws one bar per step, the current one taller", async () => {
      const { solve } = await setUp([MATH_3]);
      await solve("math");

      const heights = screen
        .getAllByTestId(TASK_SHELL_PART.PIP, { includeHiddenElements: true })
        .map((pip) => Number(styleOf(pip).height));
      expect(heights).toHaveLength(3);
      expect(heights[1]).toBeGreaterThan(heights[0]);
      expect(heights[2]).toBe(heights[0]);
    });

    it("shows no step count for a task of one step", async () => {
      await setUp([TAP]);

      expect(screen.queryByText(t("alarm.task.stepOf", { step: 1, total: 1 }))).toBeNull();
      expect(screen.queryAllByTestId(TASK_SHELL_PART.PIP, { includeHiddenElements: true })).toEqual(
        []
      );
    });

    it("shows no score, percent or praise", async () => {
      const { solve } = await setUp([MATH_3]);
      await solve("math");

      expect(screen.queryByText(/%|\d+\s*\/\s*\d+/)).toBeNull();
    });
  });

  describe("a stack", () => {
    it("names the task's place in the stack", async () => {
      await setUp([DHIKR_1, TAP]);

      expect(screen.getByText(t("alarm.task.taskOf", { task: 1, total: 2 }))).toBeVisible();
    });

    it("hands over to the next task, then runs its board", async () => {
      const { solve, onComplete } = await setUp([DHIKR_1, TAP]);
      await solve("dhikr");

      const next = t("alarm.task.next", { name: t("alarm.task.name.tap") });
      expect(screen.getByTestId(TASK_SHELL_PART.HANDOVER)).toBeVisible();
      expect(screen.getByText(next)).toBeVisible();
      expect(screen.queryByRole("button", { name: "solve tap" })).toBeNull();
      expect(said()).toContain(
        t("a11y.alarm.task.handover", {
          position: t("alarm.task.taskOf", { task: 2, total: 2 }),
          next,
        })
      );

      await advance(HANDOVER_HOLD_MS);
      expect(screen.queryByTestId(TASK_SHELL_PART.HANDOVER)).toBeNull();
      expect(screen.getByText(t("alarm.task.taskOf", { task: 2, total: 2 }))).toBeVisible();
      await solve("tap");

      expect(onComplete).toHaveBeenCalledTimes(1);
    });

    it("keeps the sound paused through the handover, then restarts quiet in full", async () => {
      const { solve, onQuietEnd } = await setUp([DHIKR_1, TAP]);
      await advance(QUIET_MS - 2 * SECOND);
      await solve("dhikr");
      await advance(HANDOVER_HOLD_MS);

      await advance(QUIET_MS - SECOND);
      expect(onQuietEnd).not.toHaveBeenCalled();
      await advance(2 * SECOND);
      expect(onQuietEnd).toHaveBeenCalledTimes(1);
    });
  });

  describe("quiet time", () => {
    it("pauses the sound as the task opens and returns it when quiet ends", async () => {
      const { onQuietStart, onQuietEnd } = await setUp([TAP]);
      expect(onQuietStart).toHaveBeenCalledTimes(1);
      expect(screen.getByText(PAUSED)).toBeVisible();

      await advance(QUIET_MS + SECOND);

      expect(onQuietEnd).toHaveBeenCalledTimes(1);
      expect(screen.getByText(SOUND_ON)).toBeVisible();
    });

    it("pauses again after a correct answer once the sound is back", async () => {
      const { solve, onQuietStart } = await setUp([MATH_3]);
      await advance(QUIET_MS + SECOND);

      await solve("math");

      expect(onQuietStart).toHaveBeenCalledTimes(2);
      expect(screen.getByText(PAUSED)).toBeVisible();
    });

    it("lasts longer with a screen reader on", async () => {
      jest.mocked(useScreenReader).mockReturnValue(true);
      const { onQuietEnd } = await setUp([TAP]);

      await advance(QUIET_MS + SECOND);
      expect(onQuietEnd).not.toHaveBeenCalled();

      await advance((QUIET_TIME_SECONDS.SCREEN_READER - QUIET_TIME_SECONDS.DEFAULT) * SECOND);
      expect(onQuietEnd).toHaveBeenCalledTimes(1);
    });

    it("returns the sound when the person goes back during quiet", async () => {
      const { back, onBack, onQuietEnd } = await setUp([TAP]);

      await back();

      expect(onQuietEnd).toHaveBeenCalledTimes(1);
      expect(onBack).toHaveBeenCalledTimes(1);
    });

    it("goes back after the sound returned without ringing it again", async () => {
      const { back, onBack, onQuietEnd } = await setUp([TAP]);
      await advance(QUIET_MS + SECOND);
      expect(onQuietEnd).toHaveBeenCalledTimes(1);

      await back();

      expect(onQuietEnd).toHaveBeenCalledTimes(1);
      expect(onBack).toHaveBeenCalledTimes(1);
    });

    it("warns of the sound's return by touch, once", async () => {
      await setUp([TAP]);
      await advance(QUIET_MS - ENDING_MS + SECOND);
      await advance(2 * SECOND);

      expect(mockHaptic).toHaveBeenCalledTimes(1);
    });

    it("gives no warning while the alarm cannot sound", async () => {
      await setUp([TAP], { audible: false });
      await advance(QUIET_MS + SECOND);

      expect(mockHaptic).not.toHaveBeenCalled();
    });

    it("counts the last seconds down on the strip without a fixed count", async () => {
      await setUp([TAP]);
      await advance(QUIET_MS - 2 * SECOND);

      expect(screen.getByTestId(TASK_SHELL_PART.QUIET_STRIP)).toHaveProp(
        "accessibilityLabel",
        t("a11y.alarm.task.quietLeft", { state: t("alarm.task.quiet.soon"), count: 2 })
      );
      expect(screen.queryByText(ENDING)).toBeNull();
    });

    it("draws the seconds in the reader's numerals", async () => {
      await act(() => i18n.changeLanguage(AppLocale.AR));
      useAppStore.setState({ locale: AppLocale.AR });
      usePreferencesStore.setState({ useWesternNumerals: false });
      try {
        await setUp([TAP]);
        expect(screen.getByText("٠:٣٠")).toBeVisible();
      } finally {
        useAppStore.setState({ locale: AppLocale.EN });
        await act(() => i18n.changeLanguage(AppLocale.EN));
      }
    });

    it.each([
      [false, `${((QUIET_MS - 2 * SECOND) / QUIET_MS) * 100}%`],
      [true, "100%"],
    ])("drains the quiet bar smoothly unless Reduce Motion (%s)", async (reduce, width) => {
      jest.mocked(useReducedMotion).mockReturnValue(reduce);
      await setUp([TAP]);
      await advance(2 * SECOND);

      const fill = screen.getByTestId(TASK_SHELL_PART.QUIET_FILL, { includeHiddenElements: true });
      expect(styleOf(fill).width).toBe(width);
    });

    it("draws no strip while the alarm cannot sound", async () => {
      await setUp([TAP], { audible: false });

      expect(screen.queryByTestId(TASK_SHELL_PART.QUIET_STRIP)).toBeNull();
    });

    // Jest runs as iOS, which has no live regions.
    it("says the last seconds once, then that the sound is on", async () => {
      await setUp([TAP]);
      await advance(QUIET_MS - ENDING_MS - SECOND);
      expect(said()).not.toContain(ENDING);

      await advance(2 * SECOND);
      await advance(2 * SECOND);
      expect(said().filter((message) => message === ENDING)).toHaveLength(1);
      expect(said()).not.toContain(SOUND_ON);

      await advance(ENDING_MS);
      expect(said()).toContain(SOUND_ON);
    });

    // Android speaks only a change on a view it already knows.
    it("holds the quiet status region mounted before its message", async () => {
      Platform.OS = PlatformType.ANDROID;
      await setUp([TAP]);
      const region = screen.getByTestId(TASK_SHELL_PART.QUIET_STATUS);
      await layOut(region);
      expect(region).toHaveProp("accessibilityLabel", "");

      await advance(QUIET_MS - ENDING_MS + SECOND);
      expect(screen.getByTestId(TASK_SHELL_PART.QUIET_STATUS)).toBe(region);
      expect(region).toHaveProp("accessibilityLabel", ENDING);

      // TalkBack says a live region again each time its text changes.
      await advance(2 * SECOND);
      expect(region).toHaveProp("accessibilityLabel", ENDING);
    });

    it("keeps the ticking seconds out of any live region", async () => {
      await setUp([TAP]);
      await advance(QUIET_MS - ENDING_MS + SECOND);

      expect(liveRegionOf(screen.getByText("0:04"))).toBeNull();
    });
  });

  describe("the way out", () => {
    const WAY_OUT_MS = WAY_OUT_SOUNDING_SECONDS * SECOND;

    it("appears after two minutes of sounding time and stops the alarm", async () => {
      const { user, onComplete } = await setUp([TAP]);
      await advance(QUIET_MS + WAY_OUT_MS - SECOND);
      expect(screen.queryByRole("button", { name: STOP })).toBeNull();

      await advance(2 * SECOND);
      expect(screen.getByText(t("alarm.task.wayOut"))).toBeVisible();
      await user.press(screen.getByRole("button", { name: STOP }));

      expect(onComplete).toHaveBeenCalledTimes(1);
    });

    it("does not count quiet time toward the two minutes", async () => {
      const { solve } = await setUp([MATH_3]);
      await advance(QUIET_MS + WAY_OUT_MS / 2);
      await solve("math");

      await advance(QUIET_MS + WAY_OUT_MS / 2 - SECOND);
      expect(screen.queryByRole("button", { name: STOP })).toBeNull();

      await advance(2 * SECOND);
      expect(screen.getByRole("button", { name: STOP })).toBeVisible();
    });

    it("counts nothing while the alarm cannot sound", async () => {
      await setUp([TAP], { audible: false });
      await advance(QUIET_MS + 2 * WAY_OUT_MS);

      expect(screen.queryByRole("button", { name: STOP })).toBeNull();
    });

    it("is said when it appears", async () => {
      await setUp([TAP]);
      await advance(QUIET_MS + WAY_OUT_MS - SECOND);
      expect(said()).not.toContain(t("alarm.task.wayOut"));

      await advance(2 * SECOND);
      expect(said()).toContain(t("alarm.task.wayOut"));
    });
  });

  describe("leaving and coming back", () => {
    it("resumes at the same step, sounding, with no new quiet time", async () => {
      const first = await setUp([MATH_3]);
      await first.solve("math");
      await first.back();
      const saved = first.onBack.mock.calls[0][0];
      await first.unmount();

      const { onQuietStart } = await setUp([MATH_3], { resume: saved });

      expect(screen.getByText(t("alarm.task.stepOf", { step: 2, total: 3 }))).toBeVisible();
      expect(onQuietStart).not.toHaveBeenCalled();
      expect(screen.getByText(SOUND_ON)).toBeVisible();
    });

    it("keeps the sounding time toward the way out", async () => {
      const WAY_OUT_MS = WAY_OUT_SOUNDING_SECONDS * SECOND;
      const first = await setUp([TAP]);
      await advance(QUIET_MS + WAY_OUT_MS - 5 * SECOND);
      await first.back();
      const saved = first.onBack.mock.calls[0][0];
      await first.unmount();
      await advance(10 * 60 * SECOND);

      await setUp([TAP], { resume: saved });
      expect(screen.queryByRole("button", { name: STOP })).toBeNull();

      await advance(6 * SECOND);
      expect(screen.getByRole("button", { name: STOP })).toBeVisible();
    });

    it("resumes after a handover at the next task", async () => {
      const first = await setUp([DHIKR_1, TAP]);
      await first.solve("dhikr");
      await first.back();
      const saved = first.onBack.mock.calls[0][0];
      await first.unmount();

      await setUp([DHIKR_1, TAP], { resume: saved });

      expect(screen.getByText(t("alarm.task.taskOf", { task: 2, total: 2 }))).toBeVisible();
      expect(screen.getByRole("button", { name: "solve tap" })).toBeVisible();
    });
  });
});
