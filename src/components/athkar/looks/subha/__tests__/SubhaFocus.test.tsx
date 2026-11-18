import { Text } from "react-native";
import { act, screen, within } from "@testing-library/react-native";
import { createGestureController } from "react-native-gesture-handler/jest-utils";

import { SUBHA_KNOTS_PART } from "@/components/athkar/looks/subha/SubhaKnots";
import { SUBHA_FOCUS_PART, SubhaFocus } from "@/components/athkar/looks/subha/SubhaFocus";
import { SUBHA_STRING_PART } from "@/components/athkar/looks/subha/SubhaString";
import { SUBHA_TENS_PART } from "@/components/athkar/looks/subha/SubhaTens";
import { ATHKAR_LOOKS } from "@/components/athkar/looks/registry";
import type { AthkarFocusProps } from "@/components/athkar/looks/types";
import { FOCUS_STAGE_PART } from "@/components/athkar/session/FocusStage";
import { ATHKAR_LOOK } from "@/constants/AthkarLook";
import { SUBHA_BEADS } from "@/constants/AthkarSubha";
import { AppLocale } from "@/enums/app";
import type { AthkarSession } from "@/hooks/useAthkarSession";
import { FOCUS_GESTURE_ID } from "@/hooks/useFocusGesture";
import i18n from "@/localization/i18n";
import { useAppStore } from "@/stores/app";
import { usePreferencesStore } from "@/stores/preferences";
import { renderWithTheme } from "@/test-helpers/theme";
import { SAMPLE_SESSION } from "@/utils/athkarSampleSession";

jest.mock("expo-blur", () => jest.requireActual("@/test-helpers/blurMock"));
jest.mock("@/hooks/useHaptic", () => jest.requireActual("@/test-helpers/hapticMock"));
jest.mock("@/utils/appLogger", () => ({
  AppLogger: { create: () => ({ i: jest.fn(), w: jest.fn(), e: jest.fn() }) },
}));
jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));

const t = i18n.t.bind(i18n);
const PERIOD = "Morning athkar";
const CLOSE = "close-slot";
const AUDIO = "audio-slot";
const hidden = { includeHiddenElements: true };
const sample = SAMPLE_SESSION.current!;
const TARGET = sample.target;

/** The sample session with the current dhikr at `count`. */
const sessionAt = (count: number): AthkarSession => ({
  ...SAMPLE_SESSION,
  counts: { ...SAMPLE_SESSION.counts, [sample.item.id]: count },
  current: { ...sample, count, done: count >= TARGET },
  canUndo: count > 0,
  add: jest.fn(),
  addMany: jest.fn(),
  undo: jest.fn(),
});

const renderFocus = async (count = 4) => {
  const props: AthkarFocusProps = {
    session: sessionAt(count),
    period: PERIOD,
    hintSeen: true,
    onHintSeen: jest.fn(),
    onStep: jest.fn(),
    close: <Text>{CLOSE}</Text>,
    audio: <Text>{AUDIO}</Text>,
  };
  const view = await renderWithTheme(<SubhaFocus {...props} />);
  return { props, view, touch: createGestureController(FOCUS_GESTURE_ID) };
};

const surface = () => screen.getByTestId(FOCUS_STAGE_PART.SURFACE);

beforeAll(() => {
  useAppStore.setState({ locale: AppLocale.EN });
  usePreferencesStore.setState({ useWesternNumerals: true });
});
beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe("SubhaFocus", () => {
  it("is the Subha look's Focus stage", () => {
    expect(ATHKAR_LOOKS[ATHKAR_LOOK.SUBHA].Focus).toBe(SubhaFocus);
  });

  it("shows the dhikr, its count, the target and the period", async () => {
    await renderFocus();
    expect(screen.getByTestId(FOCUS_STAGE_PART.TEXT, hidden)).toBeOnTheScreen();
    expect(screen.getByText("4")).toBeOnTheScreen();
    expect(
      screen.getByText(t("athkar.focus.ofTarget", { target: `${TARGET}` }), hidden)
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

  it("counts on a hanging string, a dot for each round passed", async () => {
    await renderFocus(SUBHA_BEADS.ROUND + 2);
    const string = within(surface()).getByTestId(SUBHA_STRING_PART.STRING, hidden);
    expect(within(string).getAllByTestId(SUBHA_STRING_PART.BEAD, hidden)).toHaveLength(
      SUBHA_BEADS.ROUND
    );
    expect(screen.getAllByTestId(SUBHA_TENS_PART.LIT, hidden)).toHaveLength(1);
  });

  it("draws the session as knots, with the place in figures", async () => {
    await renderFocus();
    const place = screen.getByTestId(SUBHA_FOCUS_PART.PLACE, hidden);
    expect(within(place).getByTestId(SUBHA_KNOTS_PART.CURRENT, hidden)).toBeOnTheScreen();
    expect(within(place).getByText(/\d+ \/ \d+/, hidden)).toBeOnTheScreen();
  });

  it("counts a tap", async () => {
    const { props, touch } = await renderFocus();
    const at = { translationX: 0, translationY: 0, velocityX: 0, velocityY: 0, x: 120, y: 300 };
    await act(() => touch.begin(at));
    await act(() => jest.advanceTimersByTime(50));
    await act(() => touch.fail(at));
    expect(props.session.add).toHaveBeenCalledTimes(1);
  });

  it("starts each dhikr on a fresh string", async () => {
    const { props, view } = await renderFocus(TARGET);
    const string = () => screen.getByTestId(SUBHA_STRING_PART.STRING, hidden);
    const first = string();
    const item = { ...sample.item, id: "another-dhikr" };
    const moved = sessionAt(0);
    await view.rerender(
      <SubhaFocus {...props} session={{ ...moved, current: { ...moved.current!, item } }} />
    );
    expect(string()).not.toBe(first);
  });
});
