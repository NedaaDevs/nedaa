import { AccessibilityInfo } from "react-native";
import { act, screen, userEvent, within } from "@testing-library/react-native";
import { CHALLENGE_DIFFICULTY } from "expo-alarm";

import DhikrBoard from "@/components/alarm/challenges/DhikrBoard";
import { ANNOUNCEMENT_FINISHED } from "@/constants/Accessibility";
import { DHIKR_TASK_ROWS } from "@/constants/DhikrTask";
import { ARABIC_FACES } from "@/constants/Fonts";
import {
  ANSWER_CARD_PLACE_KEY,
  ANSWER_CARD_POSITIONS,
  BOARD_PART,
  DHIKR_HOLD_MS,
  DHIKR_SPOKEN_PAUSE,
} from "@/constants/WakeTaskBoards";
import { useScreenReader } from "@/hooks/useScreenReader";
import i18n from "@/localization/i18n";
import { styleOf, type HostElement } from "@/test-helpers/text";
import { renderWithTheme } from "@/test-helpers/theme";
import { dhikrLineOf, drawDhikrRound, fullDhikr, spokenDhikrLine } from "@/utils/dhikrTask";
import { seededRng } from "@/utils/rng";

jest.mock("@/hooks/useHaptic", () => ({ useHaptic: () => jest.fn() }));
jest.mock("@/hooks/useScreenReader", () => ({ useScreenReader: jest.fn(() => false) }));
jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));

const t = i18n.t.bind(i18n);
const SEED = 5;
// A line box under this share of the size clips the marks above and below.
const MARKS_CLEAR = 1.6;
const ARABIC = new Set(Object.values(ARABIC_FACES));
const HIDDEN = { includeHiddenElements: true };

type Round = ReturnType<typeof drawDhikrRound>;

/** The rounds a board fed `seededRng(SEED)` shows, in order. */
const roundsFor = (count: number, drawn: readonly number[] = []): Round[] => {
  const rng = seededRng(SEED);
  const seen = [...drawn];
  return Array.from({ length: count }, () => {
    const round = drawDhikrRound(DHIKR_TASK_ROWS, seen, rng);
    seen.push(round.row);
    return round;
  });
};

const rowOf = (round: Round) => DHIKR_TASK_ROWS[round.row];
const spoken = (round: Round) =>
  spokenDhikrLine(rowOf(round), t("a11y.alarm.task.dhikr.gap"), DHIKR_SPOKEN_PAUSE);
const answerPlace = (round: Round) => round.cards.indexOf(rowOf(round).answer);
const otherPlace = (round: Round) => round.cards.findIndex((card) => card !== rowOf(round).answer);
const cards = () => screen.getAllByTestId(BOARD_PART.ANSWER_CARD);
const line = () => screen.getByTestId(BOARD_PART.DHIKR_TEXT);
const slot = () => screen.getByTestId(BOARD_PART.DHIKR_SLOT, HIDDEN);
const note = () => screen.getByTestId(BOARD_PART.DHIKR_NOTE, HIDDEN);
const NOTE = t("alarm.task.dhikr.completed");
const EMPTY = /^$/;
const said = () =>
  jest
    .mocked(AccessibilityInfo.announceForAccessibilityWithOptions)
    .mock.calls.map(([text]) => text);
const advance = (ms: number) => act(() => jest.advanceTimersByTime(ms));

/** The Arabic text under an element, each piece as it is drawn. */
const textsIn = (element: HostElement): HostElement[] => within(element).getAllByText(/\S/, HIDDEN);

type Finished = (event: { announcement: string; success: boolean }) => void;

/** Captures the end-of-speech listeners, so a test says when speech ends. */
const listenForSpeech = () => {
  const listeners: Finished[] = [];
  jest.spyOn(AccessibilityInfo, "addEventListener").mockImplementation(((
    event: string,
    handler: Finished
  ) => {
    if (event === ANNOUNCEMENT_FINISHED) listeners.push(handler);
    return { remove: jest.fn() } as never;
  }) as never);
  return (announcement: string) =>
    act(() => listeners.forEach((handler) => handler({ announcement, success: true })));
};

const completedLine = (round: Round) =>
  t("a11y.alarm.task.dhikr.completed", {
    word: rowOf(round).answer,
    dhikr: fullDhikr(rowOf(round)),
  });

const labelOf = (node: unknown) =>
  typeof node === "object" &&
  node !== null &&
  "props" in node &&
  typeof node.props === "object" &&
  node.props !== null &&
  "accessibilityLabel" in node.props
    ? node.props.accessibilityLabel
    : undefined;

const renderBoard = async ({ drawn }: { drawn?: readonly number[] } = {}) => {
  const onComplete = jest.fn();
  const onDraw = jest.fn();
  await renderWithTheme(
    <DhikrBoard
      difficulty={CHALLENGE_DIFFICULTY.EASY}
      onComplete={onComplete}
      drawn={drawn}
      onDraw={onDraw}
      rng={seededRng(SEED)}
    />
  );
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  return { onComplete, onDraw, user };
};

describe("DhikrBoard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.mocked(useScreenReader).mockReturnValue(false);
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("asks for the word, reads the dhikr with its gap, and names each card by place", async () => {
    const [round] = roundsFor(1);
    await renderBoard();

    expect(screen.getByText(t("alarm.task.dhikr.ask"))).toBeVisible();
    expect(line()).toHaveAccessibleName(spoken(round));
    expect(cards()).toHaveLength(ANSWER_CARD_POSITIONS.length);
    ANSWER_CARD_POSITIONS.forEach((place) => {
      const label = round.cards[place];
      expect(within(cards()[place]).getByText(label)).toBeVisible();
      expect(cards()[place]).toHaveAccessibleName(
        t("a11y.alarm.task.card", { label, place: t(ANSWER_CARD_PLACE_KEY[place]) })
      );
    });
  });

  it("draws the dhikr and its cards in the Arabic face, untracked, with room for the marks", async () => {
    await renderBoard();

    const drawn = [...textsIn(line()), ...cards().flatMap(textsIn)];
    expect(drawn.length).toBeGreaterThan(ANSWER_CARD_POSITIONS.length);
    drawn.forEach((text) => {
      const style = styleOf(text);
      expect(ARABIC.has(style.fontFamily)).toBe(true);
      expect(style.letterSpacing).toBeUndefined();
      expect(style.lineHeight / style.fontSize).toBeGreaterThanOrEqual(MARKS_CLEAR);
    });
  });

  it("draws each of the dhikr's words as written", async () => {
    const [round] = roundsFor(1);
    await renderBoard();

    const { before, touchingBefore, touchingAfter, after } = dhikrLineOf(rowOf(round));
    const words = [...before, touchingBefore, touchingAfter, ...after].filter(
      (word): word is string => word !== null
    );
    words.forEach((word) =>
      expect(within(line()).getAllByText(word, HIDDEN).length).toBeGreaterThan(0)
    );
  });

  it("counts the step once for the word that completes the dhikr", async () => {
    const [round] = roundsFor(1);
    const { onComplete, user } = await renderBoard();

    await user.press(cards()[answerPlace(round)]);
    await user.press(cards()[answerPlace(round)]);

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(within(slot()).getByText(rowOf(round).answer, HIDDEN)).toBeTruthy();
  });

  it("completes the dhikr for another card, marking no card and counting nothing", async () => {
    const [round] = roundsFor(1);
    const { onComplete, user } = await renderBoard();

    await user.press(cards()[otherPlace(round)]);

    expect(onComplete).not.toHaveBeenCalled();
    expect(screen.queryByTestId(BOARD_PART.ANSWER_MARK, HIDDEN)).toBeNull();
    cards().forEach((card) => {
      expect(card).toBeDisabled();
      expect(card.props.accessibilityLabel).not.toMatch(
        t("a11y.alarm.task.cardWrong", { card: "" })
      );
    });
    expect(within(slot()).getByText(rowOf(round).answer, HIDDEN)).toBeTruthy();
    expect(note()).toHaveTextContent(NOTE);
    expect(note()).toBeVisible();
    expect(said()).toEqual([completedLine(round)]);
  });

  it("keeps the note's line empty and unread until a dhikr is completed", async () => {
    const [round] = roundsFor(1);
    const { user } = await renderBoard();
    const reserved = styleOf(note()).minHeight;

    expect(note()).toHaveTextContent(EMPTY);
    expect(note()).not.toBeVisible();
    expect(reserved).toBeGreaterThan(0);

    await user.press(cards()[otherPlace(round)]);
    expect(note()).toHaveTextContent(NOTE);
    expect(styleOf(note()).minHeight).toBe(reserved);
  });

  it("holds the completed dhikr exactly as long as the hold", async () => {
    const [round] = roundsFor(1);
    const { user } = await renderBoard();

    await user.press(cards()[otherPlace(round)]);
    await advance(DHIKR_HOLD_MS.DEFAULT - 1);
    expect(note()).toHaveTextContent(NOTE);

    await advance(1);
    expect(note()).toHaveTextContent(EMPTY);
  });

  it("holds for a screen reader until the completed dhikr is said, past the minimum", async () => {
    jest.mocked(useScreenReader).mockReturnValue(true);
    const finishSpeech = listenForSpeech();
    const [round] = roundsFor(1);
    const { user } = await renderBoard();

    await user.press(cards()[otherPlace(round)]);
    await advance(DHIKR_HOLD_MS.SCREEN_READER);
    expect(note()).toHaveTextContent(NOTE);

    await finishSpeech(completedLine(round));
    expect(note()).toHaveTextContent(EMPTY);
  });

  it("ends a screen reader's hold at the ceiling when speech never reports its end", async () => {
    jest.mocked(useScreenReader).mockReturnValue(true);
    listenForSpeech();
    const [round] = roundsFor(1);
    const { user } = await renderBoard();

    await user.press(cards()[otherPlace(round)]);
    await advance(DHIKR_HOLD_MS.CEILING - 1);
    expect(note()).toHaveTextContent(NOTE);

    await advance(1);
    expect(note()).toHaveTextContent(EMPTY);
  });

  it("moves to a different dhikr after the hold, and counts the step on its word", async () => {
    const [first, second] = roundsFor(2);
    const focus = jest.spyOn(AccessibilityInfo, "sendAccessibilityEvent");
    const { onComplete, onDraw, user } = await renderBoard();

    await user.press(cards()[otherPlace(first)]);
    await advance(DHIKR_HOLD_MS.DEFAULT);

    const another = t("a11y.alarm.task.dhikr.another", { dhikr: spoken(second) });
    expect(rowOf(second).sourceId).not.toBe(rowOf(first).sourceId);
    expect(line()).toHaveAccessibleName(another);
    expect(screen.getByTestId(BOARD_PART.DHIKR_MESSAGE)).toHaveTextContent(
      t("alarm.task.dhikr.another")
    );
    expect(focus.mock.calls.map(([node]) => labelOf(node))).toEqual([another]);
    expect(onDraw.mock.calls).toEqual([[first.row], [second.row]]);
    cards().forEach((card) => expect(card).toBeEnabled());
    expect(onComplete).not.toHaveBeenCalled();

    await user.press(cards()[answerPlace(second)]);
    expect(onComplete).toHaveBeenCalledTimes(1);
    focus.mockRestore();
  });

  it("opens on a dhikr the run has not shown", async () => {
    const [shown] = roundsFor(1);
    const drawn = [shown.row];
    const [next] = roundsFor(1, drawn);
    const { onDraw } = await renderBoard({ drawn });

    expect(rowOf(next).sourceId).not.toBe(rowOf(shown).sourceId);
    expect(line()).toHaveAccessibleName(spoken(next));
    expect(onDraw).toHaveBeenCalledWith(next.row);
  });

  it("shows no score, count, or wrong-answer line", async () => {
    const [first] = roundsFor(1);
    const { user } = await renderBoard();

    await user.press(cards()[otherPlace(first)]);
    await advance(DHIKR_HOLD_MS.DEFAULT);

    expect(screen.queryByText(/%|\/|\d/)).toBeNull();
    expect(screen.queryByText(t("alarm.challenge.wrongAnswer"))).toBeNull();
    expect(screen.queryByText(t("alarm.task.math.wrong"))).toBeNull();
  });
});
