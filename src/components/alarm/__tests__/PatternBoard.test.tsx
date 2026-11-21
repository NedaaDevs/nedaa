import { AccessibilityInfo, StyleSheet } from "react-native";
import { act, fireEvent, screen, within } from "@testing-library/react-native";
import { CHALLENGE_DIFFICULTY } from "expo-alarm";

import PatternBoard from "@/components/alarm/challenges/PatternBoard";
import { HAPTIC_FEEDBACK } from "@/constants/Haptics";
import {
  PATTERN_HEAR_AGAIN,
  PATTERN_LENGTH,
  PATTERN_PAD_NAME_KEY,
  PATTERN_PAD_PLACE_KEY,
  PATTERN_PADS,
  PATTERN_PART,
  PATTERN_TIMING,
  type PatternPad,
} from "@/constants/WakeTaskBoards";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useScreenReader } from "@/hooks/useScreenReader";
import i18n from "@/localization/i18n";
import { layOut } from "@/test-helpers/layout";
import { FadeIn } from "@/test-helpers/reanimatedMock";
import { renderWithTheme } from "@/test-helpers/theme";
import type { ChallengeDifficulty } from "@/types/alarm";
import { drawPattern, playbackStarts, playbackTiming, type PadPattern } from "@/utils/patternOrder";
import { seededRng, type Rng } from "@/utils/rng";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("@/hooks/useScreenReader", () => ({ useScreenReader: jest.fn(() => false) }));
jest.mock("@/hooks/useReducedMotion", () => ({ useReducedMotion: jest.fn(() => false) }));
const mockHaptic = jest.fn();
jest.mock("@/hooks/useHaptic", () => ({ useHaptic: (type: string) => () => mockHaptic(type) }));

const t = i18n.t.bind(i18n);
const HIDDEN = { includeHiddenElements: true };
const SEED = 4;
const EASY = CHALLENGE_DIFFICULTY.EASY;

const name = (pad: PatternPad) => t(PATTERN_PAD_NAME_KEY[pad]);
const padName = (pad: PatternPad) =>
  t("a11y.alarm.task.card", { label: name(pad), place: t(PATTERN_PAD_PLACE_KEY[pad]) });
const spokenOrder = (pattern: PadPattern) => pattern.map(name).join(t("common.listSeparator"));

/** The orders a board fed `seededRng(SEED)` plays, one per miss. */
const orders = (difficulty: ChallengeDifficulty = EASY) => {
  const rng = seededRng(SEED);
  const first = drawPattern(difficulty, rng);
  const second = drawPattern(difficulty, rng, first);
  return { first, second, third: drawPattern(difficulty, rng, second) };
};

const pads = () => screen.getAllByTestId(PATTERN_PART.PAD, HIDDEN);
const padOf = (pad: PatternPad) => pads()[PATTERN_PADS.indexOf(pad)];
/** The pads lit now, by id: matchers walk a whole tree when given a node. */
const litPads = () =>
  PATTERN_PADS.filter(
    (pad) => within(padOf(pad)).queryByTestId(PATTERN_PART.PAD_FILL, HIDDEN) !== null
  );
const line = () => screen.getByTestId(PATTERN_PART.LINE, HIDDEN);
const status = () => screen.getByTestId(PATTERN_PART.STATUS, HIDDEN);
const dotsOn = () =>
  screen
    .getAllByTestId(PATTERN_PART.DOT, HIDDEN)
    .filter((dot) => StyleSheet.flatten(dot.props.style)?.backgroundColor !== undefined);
const said = () => jest.mocked(AccessibilityInfo.announceForAccessibility).mock.calls.flat();
const felt = () => mockHaptic.mock.calls.flat();
/** A reader focus sent to the status line while it says `label`. */
const statusSaying = (label: string) =>
  expect.objectContaining({
    props: expect.objectContaining({ testID: PATTERN_PART.STATUS, accessibilityLabel: label }),
  });
const advance = (ms: number) => act(() => jest.advanceTimersByTime(ms));

const playbackMs = (length: number, reduceMotion = false, screenReader = false) =>
  playbackStarts(length, playbackTiming({ reduceMotion, screenReader })).at(-1) ?? 0;

const renderBoard = async (
  difficulty: ChallengeDifficulty = EASY,
  rng: Rng = seededRng(SEED),
  onComplete = jest.fn(),
  opening: string | null = null
) => {
  const view = await renderWithTheme(
    <PatternBoard difficulty={difficulty} onComplete={onComplete} rng={rng} opening={opening} />
  );
  return { onComplete, unmount: view.unmount };
};

const tapAll = async (pattern: PadPattern) => {
  for (const pad of pattern) await fireEvent.press(padOf(pad));
};

/** Renders and lets the first order play out. */
const renderReady = async (difficulty: ChallengeDifficulty = EASY) => {
  const view = await renderBoard(difficulty);
  await advance(playbackMs(PATTERN_LENGTH[difficulty]));
  return view;
};

describe("PatternBoard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.mocked(useScreenReader).mockReturnValue(false);
    jest.mocked(useReducedMotion).mockReturnValue(false);
  });
  afterEach(() => jest.useRealTimers());

  it("draws four pads, each named by its shape and fixed place, left to right", async () => {
    await renderBoard();

    expect(pads()).toHaveLength(PATTERN_PADS.length);
    PATTERN_PADS.forEach((pad, index) => expect(pads()[index]).toHaveAccessibleName(padName(pad)));
    expect(screen.getByTestId(PATTERN_PART.PADS, HIDDEN)).toHaveStyle({ direction: "ltr" });
  });

  it("speaks the whole order on the status line, and takes no tap while it plays", async () => {
    const { first } = orders();
    const { onComplete } = await renderBoard();

    expect(status()).toHaveAccessibleName(
      t("a11y.alarm.task.pattern.watch", { order: spokenOrder(first) })
    );
    expect(screen.getByText(t("alarm.task.pattern.watchAsk"))).toBeVisible();
    pads().forEach((pad) => expect(pad).toBeDisabled());
    await tapAll(first);

    expect(onComplete).not.toHaveBeenCalled();
    expect(said()).toEqual([]);
  });

  it("lights each pad of the order in turn, exactly on time, then opens the turn", async () => {
    const { first } = orders();
    const length = first.length;
    const starts = playbackStarts(
      length,
      playbackTiming({ reduceMotion: false, screenReader: false })
    );
    await renderBoard();

    expect(litPads()).toEqual([]);
    expect(line()).toHaveTextContent(t("alarm.task.pattern.showing", { at: "1", total: "3" }));
    for (let pad = 0; pad < length; pad += 1) {
      const on = starts[2 * pad + 1];
      const off = starts[2 * pad + 2];
      await advance(on - 1 - (pad === 0 ? 0 : starts[2 * pad]));
      expect(litPads()).toEqual([]);
      await advance(1);
      expect(litPads()).toEqual([first[pad]]);
      expect(dotsOn()).toHaveLength(pad + 1);
      await advance(off - on - 1);
      expect(litPads()).toEqual([first[pad]]);
      await advance(1);
      expect(litPads()).toEqual([]);
    }

    pads().forEach((pad) => expect(pad).toBeEnabled());
    expect(line()).toHaveTextContent(t("alarm.task.pattern.turn", { done: "0", total: "3" }));
    expect(screen.getByText(t("alarm.task.pattern.turnAsk"))).toBeVisible();
    expect(dotsOn()).toHaveLength(0);
  });

  it("counts each right tap, says it once, and reports one solve on the last", async () => {
    const { first } = orders();
    const { onComplete } = await renderReady();

    await fireEvent.press(padOf(first[0]));
    expect(line()).toHaveTextContent(t("alarm.task.pattern.turn", { done: "1", total: "3" }));
    expect(dotsOn()).toHaveLength(1);
    expect(said()).toEqual([t("alarm.task.tapCount", { done: "1", total: "3" })]);

    await fireEvent.press(padOf(first[1]));
    await fireEvent.press(padOf(first[2]));
    await tapAll(first);

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(said()).toHaveLength(first.length - 1);
    expect(line()).toHaveTextContent(t("alarm.task.pattern.done"));
    pads().forEach((pad) => expect(pad).toBeDisabled());
  });

  it("marks a wrong pad and holds every pad, speaking nothing yet", async () => {
    const { first } = orders();
    const miss = PATTERN_PADS.find((pad) => pad !== first[0]) ?? first[0];
    const { onComplete } = await renderReady();

    await fireEvent.press(padOf(miss));
    for (const pad of PATTERN_PADS) await fireEvent.press(padOf(pad));

    expect(padOf(miss)).toHaveAccessibleName(
      t("a11y.alarm.task.cardWrong", { card: padName(miss) })
    );
    pads().forEach((pad) => expect(pad).toBeDisabled());
    expect(line()).toHaveTextContent(t("alarm.task.pattern.wrong"));
    expect(status()).toHaveAccessibleName(t("alarm.task.pattern.wrong"));
    expect(said()).toEqual([]);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("holds the wrong pad exactly as long as the hold, then plays a new order", async () => {
    const { first, second } = orders();
    const miss = PATTERN_PADS.find((pad) => pad !== first[1]) ?? first[1];
    await renderReady();

    await fireEvent.press(padOf(first[0]));
    jest.clearAllMocks();
    await fireEvent.press(padOf(miss));
    await advance(PATTERN_TIMING.WRONG_HOLD - 1);

    expect(line()).toHaveTextContent(t("alarm.task.pattern.wrong"));

    await advance(1);

    const afterMiss = t("a11y.alarm.task.pattern.afterMiss", { order: spokenOrder(second) });
    expect(second).not.toEqual(first);
    expect(status()).toHaveAccessibleName(afterMiss);
    expect(line()).toHaveTextContent(t("alarm.task.pattern.showingNew", { at: "1", total: "3" }));
    expect(dotsOn()).toHaveLength(0);
    pads().forEach((pad) => expect(pad).toBeDisabled());
    expect(said()).toEqual([]);
  });

  it("taps lightly on a right pad, warns on a wrong one, and marks the solve", async () => {
    const { first, second } = orders();
    const miss = PATTERN_PADS.find((pad) => pad !== first[1]) ?? first[1];
    await renderBoard();
    await tapAll(first);
    await advance(playbackMs(first.length));

    await fireEvent.press(padOf(first[0]));
    await fireEvent.press(padOf(miss));
    await fireEvent.press(padOf(first[0]));
    expect(felt()).toEqual([HAPTIC_FEEDBACK.LIGHT, HAPTIC_FEEDBACK.ERROR]);

    await advance(PATTERN_TIMING.WRONG_HOLD);
    await advance(playbackMs(second.length));
    await tapAll(second);

    expect(felt()).toEqual([
      HAPTIC_FEEDBACK.LIGHT,
      HAPTIC_FEEDBACK.ERROR,
      ...second.slice(1).map(() => HAPTIC_FEEDBACK.LIGHT),
      HAPTIC_FEEDBACK.SUCCESS,
    ]);
  });

  describe("reader focus", () => {
    const focus = () => jest.mocked(AccessibilityInfo.sendAccessibilityEvent);
    beforeEach(() => jest.spyOn(AccessibilityInfo, "sendAccessibilityEvent"));
    afterEach(() => focus().mockRestore());

    const missAfterPlayback = async (screenReader: boolean) => {
      const { first } = orders();
      await advance(playbackMs(first.length, false, screenReader));
      focus().mockClear();
      await fireEvent.press(padOf(PATTERN_PADS.find((pad) => pad !== first[0]) ?? first[0]));
      await advance(PATTERN_TIMING.WRONG_HOLD);
    };

    it("goes to the first order once the board is laid out, with a reader on", async () => {
      const { first } = orders();
      jest.mocked(useScreenReader).mockReturnValue(true);
      await renderBoard();
      expect(focus()).not.toHaveBeenCalled();

      await layOut(status());

      const watch = t("a11y.alarm.task.pattern.watch", { order: spokenOrder(first) });
      expect(focus()).toHaveBeenCalledTimes(1);
      expect(focus()).toHaveBeenCalledWith(statusSaying(watch), "focus");
    });

    it("goes to each new order after a miss, with a reader on", async () => {
      const { second } = orders();
      jest.mocked(useScreenReader).mockReturnValue(true);
      await renderBoard();
      await layOut(status());

      await missAfterPlayback(true);

      const afterMiss = t("a11y.alarm.task.pattern.afterMiss", { order: spokenOrder(second) });
      expect(focus()).toHaveBeenCalledTimes(1);
      expect(focus()).toHaveBeenCalledWith(statusSaying(afterMiss), "focus");
    });

    it("says the shell's opening line and the order as one message", async () => {
      const { first } = orders();
      const opening = t("alarm.task.stepOf", { step: 2, total: 3 });
      jest.mocked(useScreenReader).mockReturnValue(true);
      await renderBoard(EASY, seededRng(SEED), jest.fn(), opening);
      await layOut(status());

      const watch = t("a11y.alarm.task.pattern.watch", { order: spokenOrder(first) });
      const both = t("a11y.sentences", { first: opening, second: watch });
      expect(focus()).toHaveBeenCalledTimes(1);
      expect(focus()).toHaveBeenCalledWith(statusSaying(both), "focus");
      expect(said()).toEqual([]);
    });

    it("stays where it is with no reader on", async () => {
      await renderBoard();
      await layOut(status());
      expect(focus()).not.toHaveBeenCalled();

      await missAfterPlayback(false);

      expect(focus()).not.toHaveBeenCalled();
    });
  });

  it("never replays the old order after a miss: only the new one solves", async () => {
    const { first, second, third } = orders();
    const miss = PATTERN_PADS.find((pad) => pad !== first[0]) ?? first[0];
    const { onComplete } = await renderReady();

    await fireEvent.press(padOf(miss));
    await advance(PATTERN_TIMING.WRONG_HOLD);
    const firstLit = playbackStarts(
      second.length,
      playbackTiming({ reduceMotion: false, screenReader: false })
    )[1];
    await advance(firstLit);
    expect(litPads()).toEqual([second[0]]);
    await advance(playbackMs(second.length) - firstLit);

    await tapAll(first);
    expect(onComplete).not.toHaveBeenCalled();

    await advance(PATTERN_TIMING.WRONG_HOLD);
    await advance(playbackMs(third.length));
    await tapAll(third);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("says the current order again on request, as often as asked, keeping the taps", async () => {
    const { first } = orders();
    await renderReady();
    await fireEvent.press(padOf(first[0]));
    jest.clearAllMocks();

    const again = t("a11y.alarm.task.pattern.again", { order: spokenOrder(first) });
    expect(status().props.accessibilityActions).toEqual([
      { name: PATTERN_HEAR_AGAIN, label: t("a11y.alarm.task.pattern.hearAgain") },
    ]);
    for (let ask = 0; ask < 3; ask += 1) {
      await act(() =>
        status().props.onAccessibilityAction({ nativeEvent: { actionName: PATTERN_HEAR_AGAIN } })
      );
    }

    expect(said()).toEqual([again, again, again]);
    expect(line()).toHaveTextContent(t("alarm.task.pattern.turn", { done: "1", total: "3" }));
  });

  it("offers no replay while a wrong pad holds, so the old order is never heard again", async () => {
    const { first } = orders();
    const miss = PATTERN_PADS.find((pad) => pad !== first[0]) ?? first[0];
    await renderReady();

    await fireEvent.press(padOf(miss));

    expect(status().props.accessibilityActions ?? []).toEqual([]);
  });

  it.each([
    [CHALLENGE_DIFFICULTY.EASY, 3],
    [CHALLENGE_DIFFICULTY.MEDIUM, 4],
    [CHALLENGE_DIFFICULTY.HARD, 5],
  ])("asks %s for an order of %i, one dot each, the same after a miss", async (level, length) => {
    const { first } = orders(level);
    await renderReady(level);

    expect(screen.getAllByTestId(PATTERN_PART.DOT, HIDDEN)).toHaveLength(length);
    const miss = PATTERN_PADS.find((pad) => pad !== first[0]) ?? first[0];
    await fireEvent.press(padOf(miss));
    await advance(PATTERN_TIMING.WRONG_HOLD);
    expect(screen.getAllByTestId(PATTERN_PART.DOT, HIDDEN)).toHaveLength(length);
  });

  it("fades each light in and out, and switches it plainly under Reduce Motion", async () => {
    const { first } = orders();
    const lit = PATTERN_TIMING.LEAD_IN.DEFAULT;
    await renderBoard();
    await advance(lit);
    const fill = () => within(padOf(first[0])).getByTestId(PATTERN_PART.PAD_FILL, HIDDEN).parent;
    expect(fill()?.props.entering).toBe(FadeIn);
    await act(async () => screen.unmount());

    jest.mocked(useReducedMotion).mockReturnValue(true);
    await renderBoard();
    await advance(lit);
    expect(fill()?.props.entering).toBeUndefined();
    await advance(PATTERN_TIMING.LIT.REDUCED_MOTION - 1);
    expect(litPads()).toEqual([first[0]]);
    await advance(1);
    expect(litPads()).toEqual([]);
  });

  it("waits longer before and between lights with a screen reader on", async () => {
    const { first } = orders();
    jest.mocked(useScreenReader).mockReturnValue(true);
    await renderBoard();

    await advance(PATTERN_TIMING.LEAD_IN.SCREEN_READER - 1);
    expect(litPads()).toEqual([]);
    await advance(1);
    expect(litPads()).toEqual([first[0]]);
    await advance(PATTERN_TIMING.LIT.DEFAULT + PATTERN_TIMING.GAP.SCREEN_READER - 1);
    expect(litPads()).toEqual([]);
    await advance(1);
    expect(litPads()).toEqual([first[1]]);
  });

  it.each([
    ["mid-playback", false],
    ["mid-hold", true],
  ])("runs nothing it scheduled once it is gone %s", async (_, missed) => {
    const original = global.setTimeout;
    const fired = jest.fn();
    const timeout = jest
      .spyOn(global, "setTimeout")
      .mockImplementation((callback, ms) => original(() => (fired(), callback()), ms));
    const { unmount } = await renderBoard();
    if (missed) {
      await advance(playbackMs(PATTERN_LENGTH[EASY]));
      const { first } = orders();
      await fireEvent.press(padOf(PATTERN_PADS.find((pad) => pad !== first[0]) ?? first[0]));
    }
    await advance(PATTERN_TIMING.LEAD_IN.DEFAULT);
    expect(fired).toHaveBeenCalled();

    await act(async () => unmount());
    fired.mockClear();
    await advance(PATTERN_TIMING.WRONG_HOLD + playbackMs(PATTERN_LENGTH[EASY], true, true));

    expect(fired).not.toHaveBeenCalled();
    timeout.mockRestore();
  });

  it("shows no score, count of misses or praise", async () => {
    const { first } = orders();
    const miss = PATTERN_PADS.find((pad) => pad !== first[0]) ?? first[0];
    await renderReady();

    await fireEvent.press(padOf(miss));
    await advance(PATTERN_TIMING.WRONG_HOLD);

    expect(screen.queryByText(/%|\//)).toBeNull();
  });
});
