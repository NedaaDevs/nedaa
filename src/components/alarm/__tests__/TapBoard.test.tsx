import { AccessibilityInfo } from "react-native";
import { act, fireEvent, screen, userEvent } from "@testing-library/react-native";
import { CHALLENGE_DIFFICULTY } from "expo-alarm";

import TapBoard from "@/components/alarm/challenges/TapBoard";
import { BOARD_PART, TAP_PRESSES, TAP_PRESS_MIN_GAP_MS } from "@/constants/WakeTaskBoards";
import i18n from "@/localization/i18n";
import { renderWithTheme } from "@/test-helpers/theme";
import { CHALLENGE_DIFFICULTIES, type ChallengeDifficulty } from "@/types/alarm";

jest.mock("@/hooks/useHaptic", () => ({ useHaptic: () => jest.fn() }));

const t = i18n.t.bind(i18n);
const HIDDEN = { includeHiddenElements: true };
/** Faster than the gap, as quick tapping lands. */
const QUICK_TAP_MS = TAP_PRESS_MIN_GAP_MS - 10;

const target = () => screen.getByRole("button", { name: t("alarm.task.tapHere") });
const progress = (done: number) => t("alarm.task.tapCount", { done, total: TAP_PRESSES });
const shown = () => screen.getByTestId(BOARD_PART.TAP_COUNT);
const said = () => jest.mocked(AccessibilityInfo.announceForAccessibility).mock.calls.flat();
const wait = (ms: number) => act(() => jest.advanceTimersByTime(ms));
// A fireEvent press takes no time, so the gaps between presses are exact.
const press = () => fireEvent.press(target());

const renderBoard = async (difficulty: ChallengeDifficulty = CHALLENGE_DIFFICULTY.EASY) => {
  const onComplete = jest.fn();
  await renderWithTheme(<TapBoard difficulty={difficulty} onComplete={onComplete} />);
  return { onComplete };
};

/** Presses `count` times, each a full gap after the last. */
const pressSpaced = async (count: number) => {
  for (let i = 0; i < count; i += 1) {
    await press();
    await wait(TAP_PRESS_MIN_GAP_MS);
  }
};

describe("TapBoard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });
  afterEach(() => jest.useRealTimers());

  it("asks for the presses and starts at none", async () => {
    await renderBoard();

    expect(screen.getByText(t("alarm.task.tapAsk", { count: TAP_PRESSES }))).toBeVisible();
    expect(shown()).toHaveTextContent(progress(0));
    expect(screen.getAllByTestId(BOARD_PART.TAP_TICK, HIDDEN)).toHaveLength(TAP_PRESSES);
  });

  it("counts a real press", async () => {
    await renderBoard();

    await userEvent.setup({ advanceTimers: jest.advanceTimersByTime }).press(target());

    expect(shown()).toHaveTextContent(progress(1));
  });

  it.each(CHALLENGE_DIFFICULTIES)("solves once after every press at %s", async (difficulty) => {
    const { onComplete } = await renderBoard(difficulty);

    await pressSpaced(TAP_PRESSES - 1);
    expect(onComplete).not.toHaveBeenCalled();
    await pressSpaced(2);

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("counts a press the gap after the last counted one, not 1 ms sooner", async () => {
    await renderBoard();

    await press();
    await wait(TAP_PRESS_MIN_GAP_MS - 1);
    await press();
    expect(shown()).toHaveTextContent(progress(1));

    // The ignored press does not restart the gap.
    await wait(1);
    await press();
    expect(shown()).toHaveTextContent(progress(2));
  });

  it("reaches the count when every press comes quicker than the gap", async () => {
    const { onComplete } = await renderBoard();

    for (let i = 0; i < TAP_PRESSES * 3 && !onComplete.mock.calls.length; i += 1) {
      await press();
      await wait(QUICK_TAP_MS);
    }

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("says each count once, from one channel, and not the last", async () => {
    await renderBoard();

    await pressSpaced(TAP_PRESSES);

    const counts = Array.from({ length: TAP_PRESSES - 1 }, (_, i) => String(i + 1));
    expect(said()).toEqual(counts);
    expect(target()).toHaveAccessibleName(t("alarm.task.tapHere"));
    expect(target().props.accessibilityValue).toBeUndefined();
  });

  it("shows no praise once the presses are done", async () => {
    await renderBoard();

    await pressSpaced(TAP_PRESSES);

    expect(screen.queryByText(t("alarm.challenge.done"))).toBeNull();
    expect(shown()).toHaveTextContent(progress(TAP_PRESSES));
  });
});
