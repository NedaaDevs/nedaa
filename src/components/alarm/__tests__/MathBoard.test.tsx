import { AccessibilityInfo } from "react-native";
import { act, fireEvent, screen, userEvent, within } from "@testing-library/react-native";
import { CHALLENGE_DIFFICULTY } from "expo-alarm";

import MathBoard from "@/components/alarm/challenges/MathBoard";
import {
  ANSWER_CARD_PLACE_KEY,
  ANSWER_CARD_POSITIONS,
  BOARD_PART,
  MATH_SPOKEN_KEY,
  WRONG_CARD_HOLD_MS,
} from "@/constants/WakeTaskBoards";
import i18n from "@/localization/i18n";
import { renderWithTheme } from "@/test-helpers/theme";
import { mathRound, type MathQuestion, type MathRound } from "@/utils/mathCards";
import { seededRng } from "@/utils/rng";

jest.mock("@/hooks/useHaptic", () => ({ useHaptic: () => jest.fn() }));
jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));

const t = i18n.t.bind(i18n);
const DIFFICULTY = CHALLENGE_DIFFICULTY.MEDIUM;
// The wrong mark is drawn only; the card's label names it.
const HIDDEN = { includeHiddenElements: true };
const SEED = 11;

/** The rounds a board fed `seededRng(SEED)` asks, in order. */
const roundsFor = (count: number): MathRound[] => {
  const rng = seededRng(SEED);
  const rounds: MathRound[] = [];
  let previous: MathQuestion | undefined;
  for (let i = 0; i < count; i += 1) {
    const round = mathRound(DIFFICULTY, rng, previous);
    rounds.push(round);
    previous = round.question;
  }
  return rounds;
};

const spoken = ({ operation, left, right }: MathQuestion) =>
  t(MATH_SPOKEN_KEY[operation], { left, right });
const cards = () => screen.getAllByTestId(BOARD_PART.ANSWER_CARD);
const wrongPlace = (round: MathRound) => round.cards.findIndex((card) => card !== round.answer);
const rightPlace = (round: MathRound) => round.cards.indexOf(round.answer);
const missed = ({ question }: MathRound) =>
  t("a11y.alarm.task.math.afterMiss", { sum: spoken(question) });
const said = () => jest.mocked(AccessibilityInfo.announceForAccessibility).mock.calls.flat();
const advance = (ms: number) => act(() => jest.advanceTimersByTime(ms));

const labelOf = (node: unknown) =>
  typeof node === "object" &&
  node !== null &&
  "props" in node &&
  typeof node.props === "object" &&
  node.props !== null &&
  "accessibilityLabel" in node.props
    ? node.props.accessibilityLabel
    : undefined;

const renderBoard = async (onComplete = jest.fn()) => {
  await renderWithTheme(
    <MathBoard difficulty={DIFFICULTY} onComplete={onComplete} rng={seededRng(SEED)} />
  );
  return { onComplete, user: userEvent.setup({ advanceTimers: jest.advanceTimersByTime }) };
};

describe("MathBoard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });
  afterEach(() => jest.useRealTimers());

  it("asks the sum and offers its four cards, each named by place", async () => {
    const [round] = roundsFor(1);
    await renderBoard();

    expect(screen.getByLabelText(spoken(round.question))).toBeVisible();
    expect(cards()).toHaveLength(ANSWER_CARD_POSITIONS.length);
    ANSWER_CARD_POSITIONS.forEach((place) => {
      const label = String(round.cards[place]);
      expect(within(cards()[place]).getByText(label)).toBeVisible();
      expect(cards()[place]).toHaveAccessibleName(
        t("a11y.alarm.task.card", { label, place: t(ANSWER_CARD_PLACE_KEY[place]) })
      );
    });
  });

  it("reports one solve for the right card", async () => {
    const [round] = roundsFor(1);
    const { onComplete, user } = await renderBoard();

    await user.press(cards()[rightPlace(round)]);
    await user.press(cards()[rightPlace(round)]);

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("marks a wrong card and holds the others, speaking nothing yet", async () => {
    const [round] = roundsFor(1);
    const { onComplete, user } = await renderBoard();
    const place = wrongPlace(round);

    await user.press(cards()[place]);

    expect(onComplete).not.toHaveBeenCalled();
    expect(within(cards()[place]).getByTestId(BOARD_PART.ANSWER_MARK, HIDDEN)).toBeTruthy();
    expect(screen.getAllByTestId(BOARD_PART.ANSWER_MARK, HIDDEN)).toHaveLength(1);
    cards().forEach((card) => expect(card).toBeDisabled());
    expect(screen.getByTestId(BOARD_PART.MATH_LINE)).toHaveTextContent(t("alarm.task.math.wrong"));
    // The focused new question says the miss; a second line would be cut off.
    expect(said()).toEqual([]);
  });

  it("takes no press while the wrong card holds, the right one included", async () => {
    const [round] = roundsFor(1);
    const { onComplete } = await renderBoard();

    await fireEvent.press(cards()[wrongPlace(round)]);
    for (const place of ANSWER_CARD_POSITIONS) await fireEvent.press(cards()[place]);

    expect(onComplete).not.toHaveBeenCalled();
    expect(screen.getByTestId(BOARD_PART.MATH_SUM)).toHaveAccessibleName(spoken(round.question));
  });

  it("holds the wrong card exactly as long as the hold", async () => {
    const [first, second] = roundsFor(2);
    const { onComplete } = await renderBoard();

    await fireEvent.press(cards()[wrongPlace(first)]);
    await advance(WRONG_CARD_HOLD_MS - 1);

    expect(screen.getByTestId(BOARD_PART.MATH_SUM)).toHaveAccessibleName(spoken(first.question));
    expect(screen.getByTestId(BOARD_PART.ANSWER_MARK, HIDDEN)).toBeTruthy();

    await advance(1);

    expect(screen.getByTestId(BOARD_PART.MATH_SUM)).toHaveAccessibleName(missed(second));
    await fireEvent.press(cards()[rightPlace(second)]);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("replaces the question after the hold, with another answer", async () => {
    const [first, second] = roundsFor(2);
    const focus = jest.spyOn(AccessibilityInfo, "sendAccessibilityEvent");
    const { onComplete, user } = await renderBoard();

    await user.press(cards()[wrongPlace(first)]);
    await advance(WRONG_CARD_HOLD_MS);

    expect(second.answer).not.toBe(first.answer);
    expect(screen.queryByTestId(BOARD_PART.ANSWER_MARK, HIDDEN)).toBeNull();
    cards().forEach((card) => expect(card).toBeEnabled());
    expect(screen.getByTestId(BOARD_PART.MATH_LINE)).toHaveTextContent(t("alarm.task.math.new"));
    expect(focus.mock.calls.map(([node]) => labelOf(node))).toEqual([missed(second)]);
    expect(said()).toEqual([]);
    expect(onComplete).not.toHaveBeenCalled();

    await user.press(cards()[rightPlace(second)]);
    expect(onComplete).toHaveBeenCalledTimes(1);
    focus.mockRestore();
  });

  it("shows no score, count or penalty", async () => {
    const [first] = roundsFor(1);
    const { user } = await renderBoard();

    await user.press(cards()[wrongPlace(first)]);
    await advance(WRONG_CARD_HOLD_MS);

    expect(screen.queryByText(/%|\//)).toBeNull();
    expect(screen.queryByText(t("alarm.challenge.wrongAnswer"))).toBeNull();
  });

  describe("two taps before React commits the first", () => {
    const touch = { nativeEvent: { timestamp: 0 }, persist: () => undefined };
    const pressInPlace = (card: ReturnType<typeof cards>[number]) => {
      const { onResponderGrant, onResponderRelease } = card.props;
      onResponderGrant(touch);
      onResponderRelease(touch);
    };

    it("reports one solve for the right card pressed twice", async () => {
      const [round] = roundsFor(1);
      const { onComplete } = await renderBoard();
      const right = cards()[rightPlace(round)];

      await act(() => {
        pressInPlace(right);
        pressInPlace(right);
      });

      expect(onComplete).toHaveBeenCalledTimes(1);
    });

    it("takes no right card once a wrong one holds", async () => {
      const [round] = roundsFor(1);
      const { onComplete } = await renderBoard();
      const [wrong, right] = [cards()[wrongPlace(round)], cards()[rightPlace(round)]];

      await act(() => {
        pressInPlace(wrong);
        pressInPlace(right);
      });

      expect(onComplete).not.toHaveBeenCalled();
    });
  });
});
