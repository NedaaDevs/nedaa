import { AccessibilityInfo } from "react-native";
import {
  act,
  fireEvent,
  isHiddenFromAccessibility,
  screen,
  within,
} from "@testing-library/react-native";
import { CHALLENGE_DIFFICULTY } from "expo-alarm";

import PrayersBoard from "@/components/alarm/challenges/PrayersBoard";
import { GRID_PART } from "@/components/ui/grid";
import { PRAYER_ID, PRAYER_IDS, type PrayerId } from "@/constants/Prayer";
import { BOARD_PART, PRAYER_PLACE_KEY, WRONG_CARD_HOLD_MS } from "@/constants/WakeTaskBoards";
import i18n from "@/localization/i18n";
import { renderWithTheme } from "@/test-helpers/theme";
import { dealPrayers, reshuffleUnplaced, type PrayerBoardState } from "@/utils/prayerOrder";
import { prayerNameKey } from "@/utils/prayerName";
import { seededRng, type Rng } from "@/utils/rng";

jest.mock("@/hooks/useHaptic", () => ({ useHaptic: () => jest.fn() }));
jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));

const t = i18n.t.bind(i18n);
// Placed cards and the marks are out of the reader's tree.
const HIDDEN = { includeHiddenElements: true };
const SEED = 11;

const name = (prayer: PrayerId) => t(prayerNameKey(prayer, false));
const empty = (prayer: PrayerId) => t(PRAYER_PLACE_KEY[prayer].empty);
const filled = (prayer: PrayerId) => t(PRAYER_PLACE_KEY[prayer].filled, { prayer: name(prayer) });
const spoken = (...parts: string[]) => parts.join(" ");

/** A source that gives these draws in turn, then again from the first. */
const draws = (...values: number[]): Rng => {
  let at = 0;
  return () => values[at++ % values.length];
};

/** The deal a board fed `seededRng(SEED)` opens with, and its source. */
const opening = () => {
  const rng = seededRng(SEED);
  return { rng, state: { deal: dealPrayers(rng), placed: 0 } };
};

const cards = () => screen.getAllByTestId(BOARD_PART.ANSWER_CARD, HIDDEN);
const cardOf = (state: PrayerBoardState, prayer: PrayerId) => cards()[state.deal.indexOf(prayer)];
const places = () => screen.getByTestId(BOARD_PART.PRAYER_PLACES);
const line = () => screen.getByTestId(BOARD_PART.PRAYER_LINE);
const lineText = () =>
  line()
    .children.filter((child) => typeof child === "string")
    .join("");
const said = () => jest.mocked(AccessibilityInfo.announceForAccessibility).mock.calls.flat();
const advance = (ms: number) => act(() => jest.advanceTimersByTime(ms));

const labelOf = (node: unknown): unknown =>
  typeof node === "object" &&
  node !== null &&
  "props" in node &&
  typeof node.props === "object" &&
  node.props !== null &&
  "accessibilityLabel" in node.props
    ? node.props.accessibilityLabel
    : undefined;

/** Every accessibility label in the rendered tree, sorted. */
const allLabels = () => {
  const found: string[] = [];
  const walk = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(walk);
    const label = labelOf(node);
    if (typeof label === "string") found.push(label);
    if (typeof node === "object" && node !== null && "children" in node) walk(node.children);
  };
  walk(screen.toJSON());
  return found.sort();
};

const renderBoard = async (rng: Rng = seededRng(SEED), onComplete = jest.fn()) => {
  const view = await renderWithTheme(
    <PrayersBoard difficulty={CHALLENGE_DIFFICULTY.EASY} onComplete={onComplete} rng={rng} />
  );
  return { onComplete, unmount: view.unmount };
};

/** Taps the first `count` prayers in order. */
const placeInOrder = async (state: PrayerBoardState, count: number) => {
  for (const prayer of PRAYER_IDS.slice(0, count)) await fireEvent.press(cardOf(state, prayer));
};

describe("PrayersBoard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });
  afterEach(() => jest.useRealTimers());

  it("asks for Fajr to Isha over five shuffled cards, each named by its prayer", async () => {
    const { state } = opening();
    await renderBoard();

    expect(
      screen.getByText(
        t("alarm.task.prayers.ask", {
          first: name(PRAYER_ID.FAJR),
          last: name(PRAYER_ID.ISHA),
        })
      )
    ).toBeVisible();
    expect(cards()).toHaveLength(PRAYER_IDS.length);
    expect(state.deal).not.toEqual(PRAYER_IDS);
    state.deal.forEach((prayer, slot) => {
      expect(within(cards()[slot]).getByText(name(prayer))).toBeVisible();
      expect(cards()[slot]).toHaveAccessibleName(name(prayer));
      expect(cards()[slot]).toBeEnabled();
    });
    expect(places()).toHaveAccessibleName(empty(PRAYER_ID.FAJR));
  });

  it("places Fajr with its number, hides its card, and says it once", async () => {
    const { state } = opening();
    await renderBoard();

    await fireEvent.press(cardOf(state, PRAYER_ID.FAJR));

    const fajr = cardOf(state, PRAYER_ID.FAJR);
    expect(isHiddenFromAccessibility(fajr)).toBe(true);
    expect(within(fajr).getByText("1", HIDDEN)).toBeTruthy();
    expect(within(places()).getByText(name(PRAYER_ID.FAJR), HIDDEN)).toBeTruthy();
    const now = spoken(filled(PRAYER_ID.FAJR), empty(PRAYER_ID.DHUHR));
    expect(places()).toHaveAccessibleName(now);
    expect(said()).toEqual([now]);
  });

  it("names every filled place, then the next empty one", async () => {
    const { state } = opening();
    await renderBoard();

    await placeInOrder(state, 3);

    expect(places()).toHaveAccessibleName(
      spoken(
        filled(PRAYER_ID.FAJR),
        filled(PRAYER_ID.DHUHR),
        filled(PRAYER_ID.ASR),
        empty(PRAYER_ID.MAGHRIB)
      )
    );
    expect(said()).toHaveLength(3);
  });

  it("ignores a press on a placed card", async () => {
    const { state } = opening();
    const { onComplete } = await renderBoard();

    await fireEvent.press(cardOf(state, PRAYER_ID.FAJR));
    await fireEvent.press(cardOf(state, PRAYER_ID.FAJR));

    expect(screen.getAllByTestId(BOARD_PART.ANSWER_MARK, HIDDEN)).toHaveLength(1);
    expect(line()).toHaveTextContent(/^$/);
    expect(said()).toHaveLength(1);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("reports one solve when Isha is placed, and speaks nothing over the shell", async () => {
    const { state } = opening();
    const { onComplete } = await renderBoard();

    await placeInOrder(state, PRAYER_IDS.length);
    await placeInOrder(state, PRAYER_IDS.length);

    expect(onComplete).toHaveBeenCalledTimes(1);
    cards().forEach((card) => expect(card).toBeDisabled());
    expect(said()).toHaveLength(PRAYER_IDS.length - 1);
  });

  it("marks a later prayer wrong and holds every card, speaking nothing yet", async () => {
    const { state } = opening();
    const { onComplete } = await renderBoard();

    await fireEvent.press(cardOf(state, PRAYER_ID.FAJR));
    jest.clearAllMocks();
    await fireEvent.press(cardOf(state, PRAYER_ID.ASR));

    const asr = cardOf(state, PRAYER_ID.ASR);
    expect(asr).toHaveAccessibleName(t("a11y.alarm.task.cardWrong", { card: name(PRAYER_ID.ASR) }));
    cards().forEach((card) => expect(card).toBeDisabled());
    expect(line()).toHaveTextContent(
      t("alarm.task.prayers.wrong", { prayer: name(PRAYER_ID.ASR) })
    );
    expect(said()).toEqual([]);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("takes no press while the wrong card holds, the right one included", async () => {
    const { state } = opening();
    const { onComplete } = await renderBoard();

    await fireEvent.press(cardOf(state, PRAYER_ID.ISHA));
    for (const card of cards()) await fireEvent.press(card);

    expect(places()).toHaveAccessibleName(empty(PRAYER_ID.FAJR));
    expect(screen.getAllByTestId(BOARD_PART.ANSWER_MARK, HIDDEN)).toHaveLength(1);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("holds the wrong card exactly as long as the hold, then deals the open cards again", async () => {
    const { rng, state } = opening();
    const next = reshuffleUnplaced({ ...state, placed: 2 }, rng);
    const focus = jest.spyOn(AccessibilityInfo, "sendAccessibilityEvent");
    await renderBoard();

    await placeInOrder(state, 2);
    jest.clearAllMocks();
    await fireEvent.press(cardOf(state, PRAYER_ID.ISHA));
    await advance(WRONG_CARD_HOLD_MS - 1);

    expect(cardOf(state, PRAYER_ID.ISHA)).toHaveAccessibleName(
      t("a11y.alarm.task.cardWrong", { card: name(PRAYER_ID.ISHA) })
    );

    await advance(1);

    next.deal.forEach((prayer, slot) => {
      expect(within(cards()[slot]).getByText(name(prayer), HIDDEN)).toBeTruthy();
    });
    [PRAYER_ID.FAJR, PRAYER_ID.DHUHR].forEach((prayer) => {
      expect(next.deal.indexOf(prayer)).toBe(state.deal.indexOf(prayer));
      expect(isHiddenFromAccessibility(cardOf(next, prayer))).toBe(true);
    });
    PRAYER_IDS.slice(2).forEach((prayer) => expect(cardOf(next, prayer)).toBeEnabled());
    const missed = spoken(
      t("a11y.alarm.task.prayers.afterMiss", { prayer: name(PRAYER_ID.ISHA) }),
      filled(PRAYER_ID.FAJR),
      filled(PRAYER_ID.DHUHR),
      empty(PRAYER_ID.ASR)
    );
    expect(places()).toHaveAccessibleName(missed);
    expect(focus.mock.calls.map(([node]) => labelOf(node))).toEqual([missed]);
    expect(line()).toHaveTextContent(
      t("alarm.task.prayers.dealtNext", { prayer: name(PRAYER_ID.DHUHR) })
    );
    expect(said()).toEqual([]);
    focus.mockRestore();
  });

  it("keeps each card on its slot across a new deal, so no card slides", async () => {
    const { state } = opening();
    await renderBoard();
    const before = screen.getAllByTestId(GRID_PART.ITEM);

    await fireEvent.press(cardOf(state, PRAYER_ID.ISHA));
    await advance(WRONG_CARD_HOLD_MS);

    const after = screen.getAllByTestId(GRID_PART.ITEM);
    expect(after).toHaveLength(before.length);
    after.forEach((slot, index) => expect(slot).toBe(before[index]));
  });

  // With two cards open, telling "moved" from "stayed" would name the slot.
  it("says and shows the same after a miss whether or not a card moved", async () => {
    const deal = dealPrayers(draws(0.5));
    const seen = async (reshuffle: number) => {
      const focus = jest.spyOn(AccessibilityInfo, "sendAccessibilityEvent");
      const { unmount } = await renderBoard(draws(0.5, reshuffle));
      const board = { deal, placed: 0 };
      for (const prayer of PRAYER_IDS.slice(0, -2)) await fireEvent.press(cardOf(board, prayer));
      await fireEvent.press(cardOf(board, PRAYER_ID.ISHA));
      await advance(WRONG_CARD_HOLD_MS);
      const result = {
        order: cards().map((card) => labelOf(card)),
        line: lineText(),
        labels: allLabels(),
        said: said(),
        focused: focus.mock.calls.map(([node]) => labelOf(node)),
      };
      focus.mockRestore();
      jest.clearAllMocks();
      await act(unmount);
      return result;
    };

    const stayed = await seen(0);
    const moved = await seen(0.999999);

    expect(moved.order).not.toEqual(stayed.order);
    expect(moved.line).toEqual(stayed.line);
    expect(moved.labels).toEqual(stayed.labels);
    expect(moved.said).toEqual(stayed.said);
    expect(moved.focused).toEqual(stayed.focused);
  });

  it("says the cards were dealt again when nothing was placed", async () => {
    const { state } = opening();
    await renderBoard();

    await fireEvent.press(cardOf(state, PRAYER_ID.ISHA));
    await advance(WRONG_CARD_HOLD_MS);

    expect(line()).toHaveTextContent(t("alarm.task.prayers.dealt"));
  });

  it("solves after a miss with the cards in their new places", async () => {
    const { rng, state } = opening();
    const next = reshuffleUnplaced(state, rng);
    const { onComplete } = await renderBoard();

    await fireEvent.press(cardOf(state, PRAYER_ID.ISHA));
    await advance(WRONG_CARD_HOLD_MS);
    await placeInOrder(next, PRAYER_IDS.length);

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(line()).toHaveTextContent(/^$/);
  });

  describe("two taps before React commits the first", () => {
    const touch = { nativeEvent: { timestamp: 0 }, persist: () => undefined };
    const pressInPlace = (card: ReturnType<typeof cards>[number]) => {
      const { onResponderGrant, onResponderRelease } = card.props;
      onResponderGrant(touch);
      onResponderRelease(touch);
    };

    it("takes no right card once a wrong one holds", async () => {
      const { state } = opening();
      await renderBoard();
      const [isha, fajr] = [cardOf(state, PRAYER_ID.ISHA), cardOf(state, PRAYER_ID.FAJR)];

      await act(() => {
        pressInPlace(isha);
        pressInPlace(fajr);
      });

      expect(places()).toHaveAccessibleName(empty(PRAYER_ID.FAJR));
      expect(cardOf(state, PRAYER_ID.ISHA)).toHaveAccessibleName(
        t("a11y.alarm.task.cardWrong", { card: name(PRAYER_ID.ISHA) })
      );
    });

    it("places both of two right cards", async () => {
      const { state } = opening();
      await renderBoard();
      const [fajr, dhuhr] = [cardOf(state, PRAYER_ID.FAJR), cardOf(state, PRAYER_ID.DHUHR)];

      await act(() => {
        pressInPlace(fajr);
        pressInPlace(dhuhr);
      });

      expect(places()).toHaveAccessibleName(
        spoken(filled(PRAYER_ID.FAJR), filled(PRAYER_ID.DHUHR), empty(PRAYER_ID.ASR))
      );
      expect(line()).toHaveTextContent(/^$/);
    });

    it("solves once from Isha pressed twice", async () => {
      const { state } = opening();
      const { onComplete } = await renderBoard();
      await placeInOrder(state, PRAYER_IDS.length - 1);
      const isha = cardOf(state, PRAYER_ID.ISHA);

      await act(() => {
        pressInPlace(isha);
        pressInPlace(isha);
      });

      expect(onComplete).toHaveBeenCalledTimes(1);
    });
  });

  it("shows no score, count of misses or praise", async () => {
    const { state } = opening();
    await renderBoard();

    await fireEvent.press(cardOf(state, PRAYER_ID.ISHA));
    await advance(WRONG_CARD_HOLD_MS);

    expect(screen.queryByText(/%|\//)).toBeNull();
    expect(screen.queryByText(t("alarm.challenge.wrongAnswer"))).toBeNull();
  });
});
