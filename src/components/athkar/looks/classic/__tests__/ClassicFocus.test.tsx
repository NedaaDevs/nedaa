import { AccessibilityInfo, Text } from "react-native";
import { act, fireEvent, screen, within } from "@testing-library/react-native";
import { createGestureController } from "react-native-gesture-handler/jest-utils";

import { CLASSIC_FOCUS_PART, ClassicFocus } from "@/components/athkar/looks/classic/ClassicFocus";
import { POSITION_PART } from "@/components/athkar/looks/classic/ClassicPosition";
import type { AthkarFocusProps } from "@/components/athkar/looks/types";
import { FOCUS_HINT_PART, signedCount } from "@/components/athkar/session/FocusHint";
import { A11Y_ACTION } from "@/constants/Accessibility";
import { FOCUS_ACTION, FOCUS_GESTURE, FOCUS_TIMING, STEP } from "@/constants/AthkarFocus";
import { MARK_STATE, SESSION_STATUS } from "@/constants/AthkarSession";
import { AppLocale } from "@/enums/app";
import type { AthkarSession } from "@/hooks/useAthkarSession";
import { FOCUS_GESTURE_ID } from "@/hooks/useFocusGesture";
import i18n from "@/localization/i18n";
import { useAppStore } from "@/stores/app";
import { useAthkarStore } from "@/stores/athkar";
import { usePreferencesStore } from "@/stores/preferences";
import { renderWithTheme } from "@/test-helpers/theme";
import { positionMarks, type SessionItem } from "@/utils/athkarSession";
import { LTR_ISOLATE } from "@/utils/digits";

let mockReduced = false;

jest.mock("@/hooks/useHaptic", () => jest.requireActual("@/test-helpers/hapticMock"));
jest.mock("@/hooks/useReducedMotion", () => ({ useReducedMotion: () => mockReduced }));
jest.mock("@/utils/appLogger", () => ({
  AppLogger: { create: () => ({ i: jest.fn(), w: jest.fn(), e: jest.fn() }) },
}));
jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));

const t = i18n.t.bind(i18n);
const TOTAL = 5;
const TARGET = 33;
const PLACE = 2;
const PERIOD = "Morning athkar";
const CLOSE = "close-slot";
const AUDIO = "audio-slot";
const hidden = { includeHiddenElements: true };
const STILL = { translationX: 0, translationY: 0, velocityX: 0, velocityY: 0, y: 0 };

/** A text key no locale holds, so it draws as written. */
const textOf = (i: number) => `dhikr ${i + 1}`;

const items = (): SessionItem[] =>
  Array.from({ length: TOTAL }, (_, i) => ({
    id: `${i}`,
    target: TARGET,
    textKeys: [textOf(i)],
    itemsPerRound: 1,
  }));

type Options = { count?: number; place?: number; audioOwnsCount?: boolean; text?: string };

const sessionOf = ({
  count = 4,
  place = PLACE,
  audioOwnsCount = false,
  text,
}: Options = {}): AthkarSession => {
  const list = items();
  const counts = { [list[place].id]: count };
  return {
    status: SESSION_STATUS.READY,
    items: list,
    counts,
    index: place,
    current: {
      item: list[place],
      textKey: text ?? textOf(place),
      count,
      target: TARGET,
      done: count >= TARGET,
      audioOwnsCount,
    },
    next: place < TOTAL - 1 ? { textKey: textOf(place + 1) } : null,
    marks: positionMarks(list, counts, place),
    canUndo: count > 0,
    advancePending: false,
    canStep: { previous: place > 0, next: place < TOTAL - 1 },
    add: jest.fn(),
    addMany: jest.fn(),
    undo: jest.fn(),
    jumpTo: jest.fn(),
    step: jest.fn(),
  };
};

const propsOf = (options?: Options, over: Partial<AthkarFocusProps> = {}): AthkarFocusProps => ({
  session: sessionOf(options),
  period: PERIOD,
  hintSeen: true,
  onHintSeen: jest.fn(),
  onStep: jest.fn(),
  close: <Text>{CLOSE}</Text>,
  audio: <Text>{AUDIO}</Text>,
  ...over,
});

const renderFocus = async (options?: Options, over?: Partial<AthkarFocusProps>) => {
  const props = propsOf(options, over);
  const view = await renderWithTheme(<ClassicFocus {...props} />);
  return { props, view, touch: createGestureController(FOCUS_GESTURE_ID) };
};

const surface = () => screen.getByTestId(CLASSIC_FOCUS_PART.SURFACE);
const actionNames = () =>
  (surface().props.accessibilityActions as { name: string }[]).map((action) => action.name);
const run = (actionName: string) =>
  act(() => fireEvent(surface(), "accessibilityAction", { nativeEvent: { actionName } }));
const wait = (ms: number) => act(() => jest.advanceTimersByTime(ms));
const tap = async (touch: ReturnType<typeof createGestureController>) => {
  await act(() => touch.begin(STILL));
  await wait(50);
  await act(() => touch.fail(STILL));
};
const dragSide = async (touch: ReturnType<typeof createGestureController>, dx: number) => {
  const at = { ...STILL, translationX: dx };
  await act(() => touch.begin(STILL));
  await act(() => touch.activate(at));
  await act(() => touch.update(at));
  await act(() => touch.end(at));
};

beforeAll(() => {
  useAppStore.setState({ locale: AppLocale.EN });
  usePreferencesStore.setState({ useWesternNumerals: true });
});
beforeEach(() => {
  jest.useFakeTimers();
  mockReduced = false;
});
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe("ClassicFocus", () => {
  it("shows the dhikr, its count, the target and the period", async () => {
    await renderFocus();
    expect(screen.getByText(textOf(PLACE), hidden)).toBeOnTheScreen();
    expect(screen.getByText("4")).toBeOnTheScreen();
    expect(
      screen.getByText(t("athkar.focus.ofTarget", { target: "33" }), hidden)
    ).toBeOnTheScreen();
    expect(screen.getByText(PERIOD, hidden)).toBeOnTheScreen();
  });

  it("places the screen's two controls outside the gesture surface", async () => {
    await renderFocus();
    expect(screen.getByText(CLOSE)).toBeOnTheScreen();
    expect(screen.getByText(AUDIO)).toBeOnTheScreen();
    expect(within(surface()).queryByText(CLOSE)).toBeNull();
    expect(within(surface()).queryByText(AUDIO)).toBeNull();
  });

  it("keeps the period's name beside the controls, off the surface", async () => {
    await renderFocus();
    expect(screen.getByText(PERIOD)).toBeOnTheScreen();
    expect(within(surface()).queryByText(PERIOD, hidden)).toBeNull();
  });

  it("is one button that names the dhikr and its count", async () => {
    await renderFocus();
    const counted = t("a11y.athkar.cardProgress", { current: "4", total: "33" });
    expect(surface()).toHaveProp("role", "button");
    expect(surface().props.accessibilityLabel).toContain(textOf(PLACE));
    expect(surface().props.accessibilityLabel).toContain(counted);
  });

  describe("a dhikr with a translation", () => {
    const ARABIC = "سبحان الله";
    const LINES = ["Glory be to God", "said in the morning"];
    const text = [...LINES, ARABIC].join("\n");
    const showTranslation = (show: boolean) =>
      useAthkarStore.setState((s) => ({ settings: { ...s.settings, showTranslation: show } }));

    it("names the Arabic and every line of the translation it shows", async () => {
      showTranslation(true);
      await renderFocus({ text });
      const label = surface().props.accessibilityLabel as string;
      expect(label).toContain(ARABIC);
      for (const line of LINES) expect(label).toContain(line);
    });

    it("names the Arabic alone with translations off", async () => {
      showTranslation(false);
      await renderFocus({ text });
      const label = surface().props.accessibilityLabel as string;
      expect(label).toContain(ARABIC);
      expect(label).not.toContain(LINES[0]);
    });
  });

  it("gives a screen reader every gesture as an action", async () => {
    const { props } = await renderFocus();
    await run(A11Y_ACTION.ACTIVATE);
    expect(props.session.add).toHaveBeenCalledTimes(1);
    await run(FOCUS_ACTION.ADD_MANY);
    expect(props.session.addMany).toHaveBeenCalledWith(FOCUS_GESTURE.HOLD_ADD);
    await run(FOCUS_ACTION.UNDO);
    expect(props.session.undo).toHaveBeenCalledTimes(1);
    await run(FOCUS_ACTION.NEXT);
    expect(props.onStep).toHaveBeenLastCalledWith(STEP.NEXT);
    await run(FOCUS_ACTION.PREVIOUS);
    expect(props.onStep).toHaveBeenLastCalledWith(STEP.PREVIOUS);
  });

  it("labels the add-many action with what it adds", async () => {
    await renderFocus({ count: TARGET - 3 });
    const actions = surface().props.accessibilityActions as { name: string; label?: string }[];
    expect(actions.find((action) => action.name === FOCUS_ACTION.ADD_MANY)?.label).toBe(
      t("a11y.athkar.focus.addMany", { count: 3 })
    );
  });

  it("lists only the actions that can run", async () => {
    await renderFocus({ count: 0, place: 0 });
    expect(actionNames()).toEqual([A11Y_ACTION.ACTIVATE, FOCUS_ACTION.ADD_MANY, FOCUS_ACTION.NEXT]);
  });

  it("drops add-many when one repeat is left", async () => {
    await renderFocus({ count: TARGET - 1 });
    expect(actionNames()).not.toContain(FOCUS_ACTION.ADD_MANY);
  });

  it("keeps only the steps while audio counts, and says why", async () => {
    await renderFocus({ audioOwnsCount: true });
    expect(actionNames()).toEqual([FOCUS_ACTION.NEXT, FOCUS_ACTION.PREVIOUS]);
    expect(screen.getByText(t("athkar.session.audioCounts"), hidden)).toBeOnTheScreen();
    expect(surface().props.accessibilityLabel).toContain(t("athkar.session.audioCounts"));
    // A disabled element hides its actions from a screen reader.
    expect(surface()).not.toBeDisabled();
    expect(surface().props.accessibilityHint).toBeUndefined();
  });

  it("counts nothing by an action while audio counts", async () => {
    const { props } = await renderFocus({ audioOwnsCount: true });
    await run(A11Y_ACTION.ACTIVATE);
    await run(FOCUS_ACTION.ADD_MANY);
    await run(FOCUS_ACTION.UNDO);
    expect(props.session.add).not.toHaveBeenCalled();
    expect(props.session.addMany).not.toHaveBeenCalled();
    expect(props.session.undo).not.toHaveBeenCalled();
  });

  it("hints at the tap while a tap can count", async () => {
    const { view } = await renderFocus();
    expect(surface().props.accessibilityHint).toBe(t("athkar.focus.tapToIncrement"));
    await view.rerender(<ClassicFocus {...propsOf({ count: TARGET })} />);
    expect(surface().props.accessibilityHint).toBeUndefined();
  });

  it("shows no undo under a drag down while audio counts", async () => {
    const { props, touch } = await renderFocus({ audioOwnsCount: true });
    const at = { ...STILL, translationY: FOCUS_GESTURE.UNDO_AT + 6 };
    await act(() => touch.begin(STILL));
    await act(() => touch.activate(at));
    await act(() => touch.update(at));
    expect(screen.queryByText(signedCount("−", "1"), hidden)).toBeNull();
    await act(() => touch.end(at));
    expect(props.session.undo).not.toHaveBeenCalled();
  });

  it("dims the text under a side drag with Reduce Motion", async () => {
    mockReduced = true;
    const { touch } = await renderFocus();
    const at = { ...STILL, translationX: -80 };
    const row = () => screen.getByTestId(CLASSIC_FOCUS_PART.ROW, hidden);
    const rest = row().props.style[1].transform;
    await act(() => touch.begin(STILL));
    await act(() => touch.activate(at));
    await act(() => touch.update(at));
    expect(row().props.style[1].opacity).toBeLessThan(1);
    expect(row().props.style[1].transform).toEqual(rest);
  });

  describe("what it says", () => {
    // React Native's jest setup holds this as one mock for the whole file.
    const announce = jest.mocked(AccessibilityInfo.announceForAccessibility);
    const placeLine = (place: number) =>
      t("athkar.audio.thikrProgress", { current: `${place + 1}`, total: `${TOTAL}` });
    const counted = (count: number) =>
      t("a11y.athkar.cardProgress", { current: `${count}`, total: `${TARGET}` });
    const said = () => announce.mock.calls.map(([line]) => line);
    const show = (view: Awaited<ReturnType<typeof renderFocus>>["view"], options: Options) =>
      view.rerender(<ClassicFocus {...propsOf(options)} />);

    beforeEach(() => announce.mockClear());

    it("says nothing as it opens", async () => {
      await renderFocus();
      expect(said()).toEqual([]);
    });

    it("says each new count", async () => {
      const { view } = await renderFocus({ count: 4 });
      await show(view, { count: 5 });
      expect(said()).toEqual([counted(5)]);
    });

    it("says a count undone to nothing, not the place", async () => {
      const { view } = await renderFocus({ count: 1 });
      await show(view, { count: 0 });
      expect(said()).toEqual([counted(0)]);
    });

    it("says the place of a new dhikr, with a count it already has", async () => {
      const { view } = await renderFocus({ count: 0 });
      await show(view, { place: PLACE + 1, count: 0 });
      await show(view, { place: PLACE + 2, count: 7 });
      expect(said()).toEqual([
        placeLine(PLACE + 1),
        t("a11y.join", { first: placeLine(PLACE + 2), second: counted(7) }),
      ]);
    });

    it("leaves a count audio made unsaid once audio stops", async () => {
      const { view } = await renderFocus({ count: 4, audioOwnsCount: true });
      await show(view, { count: 6, audioOwnsCount: true });
      await show(view, { count: 6 });
      expect(said()).toEqual([]);
    });

    it("does not say the count again when the edge line goes", async () => {
      const { view, touch } = await renderFocus({ place: TOTAL - 1, count: 4 });
      await show(view, { place: TOTAL - 1, count: 5 });
      await dragSide(touch, -300);
      await wait(FOCUS_TIMING.EDGE_MESSAGE_MS);
      expect(said()).toEqual([counted(5), t("athkar.session.lastThikr")]);
    });

    it("leaves the counts audio adds unsaid", async () => {
      const { view } = await renderFocus({ count: 4, audioOwnsCount: true });
      await show(view, { count: 5, audioOwnsCount: true });
      await show(view, { count: 6, audioOwnsCount: true });
      expect(said()).toEqual([]);
    });
  });

  it("counts a tap and steps on a side drag", async () => {
    const { props, touch } = await renderFocus();
    await tap(touch);
    expect(props.session.add).toHaveBeenCalledTimes(1);
    await dragSide(touch, -300);
    expect(props.onStep).toHaveBeenCalledWith(STEP.NEXT);
  });

  it("shows the place when the dhikr changes, then lets it go", async () => {
    const { view } = await renderFocus();
    const place = () => screen.getByTestId(CLASSIC_FOCUS_PART.PLACE, hidden);
    expect(place()).toHaveStyle({ opacity: 0 });
    await view.rerender(<ClassicFocus {...propsOf({ place: PLACE + 1 })} />);
    expect(place()).toHaveStyle({ opacity: 1 });
    const figures = `${LTR_ISOLATE.OPEN}${PLACE + 2} / ${TOTAL}${LTR_ISOLATE.CLOSE}`;
    expect(within(place()).getByText(figures, hidden)).toBeOnTheScreen();
    expect(
      within(place()).getByTestId(POSITION_PART[MARK_STATE.CURRENT], hidden)
    ).toBeOnTheScreen();
    await wait(FOCUS_TIMING.POSITION_MS);
    expect(place()).toHaveStyle({ opacity: 0 });
  });

  it("says the last dhikr is the last, for a while", async () => {
    const { touch } = await renderFocus({ place: TOTAL - 1 });
    const last = t("athkar.session.lastThikr");
    await dragSide(touch, -300);
    expect(screen.getByText(last, hidden)).toBeOnTheScreen();
    await wait(FOCUS_TIMING.EDGE_MESSAGE_MS);
    expect(screen.queryByText(last, hidden)).toBeNull();
  });

  it("drops the line when the place moves", async () => {
    const { touch, view } = await renderFocus({ place: TOTAL - 1 });
    await dragSide(touch, -300);
    await view.rerender(<ClassicFocus {...propsOf({ place: TOTAL - 2 })} />);
    expect(screen.queryByText(t("athkar.session.lastThikr"), hidden)).toBeNull();
  });

  it("keeps the line for its full time after a second try", async () => {
    const { touch } = await renderFocus({ place: TOTAL - 1 });
    const last = t("athkar.session.lastThikr");
    await dragSide(touch, -300);
    await wait(FOCUS_TIMING.EDGE_MESSAGE_MS - 100);
    await dragSide(touch, -300);
    await wait(FOCUS_TIMING.EDGE_MESSAGE_MS - 100);
    expect(screen.getByText(last, hidden)).toBeOnTheScreen();
    await wait(100);
    expect(screen.queryByText(last, hidden)).toBeNull();
  });

  it("shows the place with the line", async () => {
    const { touch } = await renderFocus({ place: TOTAL - 1 });
    await dragSide(touch, -300);
    expect(screen.getByTestId(CLASSIC_FOCUS_PART.PLACE, hidden)).toHaveStyle({ opacity: 1 });
  });

  it("says the first dhikr is the first", async () => {
    const { touch } = await renderFocus({ place: 0 });
    await dragSide(touch, 300);
    expect(screen.getByText(t("athkar.focus.firstThikr"), hidden)).toBeOnTheScreen();
  });

  it("shows the hint on a first visit and lets it go at the first touch", async () => {
    const { props, touch } = await renderFocus({}, { hintSeen: false });
    expect(screen.getByTestId(FOCUS_HINT_PART.SIDES, hidden)).toHaveStyle({ opacity: 1 });
    expect(screen.getByTestId(FOCUS_HINT_PART.GESTURES, hidden)).toHaveStyle({ opacity: 1 });
    await tap(touch);
    expect(props.onHintSeen).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId(FOCUS_HINT_PART.SIDES, hidden)).toHaveStyle({ opacity: 0 });
    await tap(touch);
    expect(props.onHintSeen).toHaveBeenCalledTimes(1);
  });

  it("shows no hint once it has been seen", async () => {
    await renderFocus();
    expect(screen.queryByTestId(FOCUS_HINT_PART.SIDES, hidden)).toBeNull();
  });

  it("says a finished dhikr is complete", async () => {
    await renderFocus({ count: TARGET });
    expect(screen.getByText(t("athkar.session.thikrDone"), hidden)).toBeOnTheScreen();
  });

  it("leaves long text whole, in a view that scrolls", async () => {
    await renderFocus();
    expect(screen.getByText(textOf(PLACE), hidden).props.numberOfLines).toBeUndefined();
    expect(screen.getByTestId(CLASSIC_FOCUS_PART.TEXT_SCROLL, hidden)).toBeOnTheScreen();
  });
  describe("long text", () => {
    const SPACE = 400;
    const layout = (height: number) => ({ nativeEvent: { layout: { y: 0, height } } });
    const scroll = () => screen.getByTestId(CLASSIC_FOCUS_PART.TEXT_SCROLL, hidden);
    const text = () => screen.getByTestId(CLASSIC_FOCUS_PART.TEXT, hidden);
    const measure = async (first: () => void, second: () => void) => {
      await act(first);
      await act(second);
    };
    const space = () => fireEvent(scroll(), "layout", layout(SPACE));
    const lines = (height: number) => () => fireEvent(text(), "layout", layout(height));

    test("text that fits does not scroll", async () => {
      await renderFocus();
      await measure(lines(SPACE / 2), space);
      expect(scroll().props.scrollEnabled).toBe(false);
    });

    test.each([
      ["its space is measured first", true],
      ["its lines are measured first", false],
    ])("text taller than its space scrolls when %s", async (_name, spaceFirst) => {
      await renderFocus();
      const tall = lines(SPACE * 2);
      await measure(spaceFirst ? space : tall, spaceFirst ? tall : space);
      expect(scroll().props.scrollEnabled).toBe(true);
    });

    test("text taller than its space scrolls when both are measured at once", async () => {
      await renderFocus();
      // One batch, as a device delivers them.
      const [onSpace, onLines] = [scroll().props.onLayout, text().props.onLayout];
      await act(() => {
        onSpace(layout(SPACE));
        onLines(layout(SPACE * 2));
      });
      expect(scroll().props.scrollEnabled).toBe(true);
    });

    test("text that grows to fill its space still does not scroll", async () => {
      await renderFocus();
      await measure(space, lines(SPACE));
      expect(scroll().props.scrollEnabled).toBe(false);
    });
  });
});
