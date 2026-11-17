import { Text } from "react-native";
import { act, screen, within } from "@testing-library/react-native";
import { createGestureController } from "react-native-gesture-handler/jest-utils";

import { HORIZON_ARC_PART } from "@/components/athkar/looks/horizon/HorizonArc";
import { HORIZON_FOCUS_PART, HorizonFocus } from "@/components/athkar/looks/horizon/HorizonFocus";
import { HORIZON_ORB_PART } from "@/components/athkar/looks/horizon/HorizonOrb";
import type { AthkarFocusProps } from "@/components/athkar/looks/types";
import { FOCUS_STAGE_PART } from "@/components/athkar/session/FocusStage";
import { HORIZON_BLOOM, HORIZON_ORB } from "@/constants/AthkarHorizon";
import { AppLocale } from "@/enums/app";
import type { AthkarSession } from "@/hooks/useAthkarSession";
import { FOCUS_GESTURE_ID } from "@/hooks/useFocusGesture";
import i18n from "@/localization/i18n";
import { useAppStore } from "@/stores/app";
import { usePreferencesStore } from "@/stores/preferences";
import { renderWithTheme } from "@/test-helpers/theme";
import { SAMPLE_SESSION } from "@/utils/athkarSampleSession";

let mockReduced = false;

jest.mock("expo-blur", () => jest.requireActual("@/test-helpers/blurMock"));
jest.mock("@/hooks/useHaptic", () => jest.requireActual("@/test-helpers/hapticMock"));
jest.mock("@/hooks/useReducedMotion", () => ({ useReducedMotion: () => mockReduced }));
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

const renderFocus = async (count = 4, over: Partial<AthkarFocusProps> = {}) => {
  const props: AthkarFocusProps = {
    session: sessionAt(count),
    period: PERIOD,
    hintSeen: true,
    onHintSeen: jest.fn(),
    onStep: jest.fn(),
    close: <Text>{CLOSE}</Text>,
    audio: <Text>{AUDIO}</Text>,
    ...over,
  };
  const view = await renderWithTheme(<HorizonFocus {...props} />);
  return { props, view, touch: createGestureController(FOCUS_GESTURE_ID) };
};

const flat = (testID: string) =>
  Object.assign({}, ...[screen.getByTestId(testID, hidden).props.style].flat(Infinity));
const discScale = () => flat(HORIZON_ORB_PART.DISC).transform[0].scale as number;
const surface = () => screen.getByTestId(FOCUS_STAGE_PART.SURFACE);

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

describe("HorizonFocus", () => {
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
    expect(within(surface()).queryByText(CLOSE)).toBeNull();
    expect(within(surface()).queryByText(AUDIO)).toBeNull();
  });

  it("grows the sun disc with the count, from a sliver to whole", async () => {
    const { view } = await renderFocus(0);
    expect(discScale()).toBeCloseTo(HORIZON_ORB.MIN_SCALE);
    await view.unmount();
    await renderFocus(TARGET);
    expect(discScale()).toBeCloseTo(1);
  });

  it("shrinks the disc when a repeat is taken back", async () => {
    const { view, props } = await renderFocus(10);
    const before = discScale();
    await view.rerender(<HorizonFocus {...props} session={sessionAt(9)} />);
    expect(discScale()).toBeLessThan(before);
  });

  it("draws the session on the sun's arc, with the place in figures", async () => {
    await renderFocus();
    const place = screen.getByTestId(FOCUS_STAGE_PART.PLACE, hidden);
    expect(within(place).getByTestId(HORIZON_ARC_PART.SUN, hidden)).toBeOnTheScreen();
    const figures = screen.getByTestId(HORIZON_FOCUS_PART.FIGURES, hidden);
    expect(within(figures).getByText(/\d+ \/ \d+/, hidden)).toBeOnTheScreen();
  });

  it("counts a tap, and leaves its light where the finger landed", async () => {
    const { props, touch } = await renderFocus();
    const at = { translationX: 0, translationY: 0, velocityX: 0, velocityY: 0, x: 120, y: 300 };
    await act(() => touch.begin(at));
    await act(() => jest.advanceTimersByTime(50));
    await act(() => touch.fail(at));
    expect(props.session.add).toHaveBeenCalledTimes(1);
    const { transform } = flat(HORIZON_FOCUS_PART.BLOOM);
    expect(transform[0].translateX).toBe(120 - HORIZON_BLOOM.SIZE / 2);
    expect(transform[1].translateY).toBe(300 - HORIZON_BLOOM.SIZE / 2);
  });

  it("opens each dhikr on a new sun, so a lower count is no undo", async () => {
    const { props, view } = await renderFocus(TARGET);
    const ring = () => screen.getByTestId(HORIZON_ORB_PART.RING, hidden);
    const first = ring();

    await view.rerender(<HorizonFocus {...props} session={sessionAt(TARGET - 1)} />);
    expect(ring()).toBe(first);

    const item = { ...sample.item, id: "another-dhikr" };
    const moved = sessionAt(0);
    await view.rerender(
      <HorizonFocus {...props} session={{ ...moved, current: { ...moved.current!, item } }} />
    );
    expect(ring()).not.toBe(first);
  });

  it("places the light from the screen's left in either direction", async () => {
    await renderFocus();
    const bloom = screen.getByTestId(HORIZON_FOCUS_PART.BLOOM, hidden);
    expect(bloom.parent).toHaveStyle({ direction: "ltr" });
  });

  it("leaves no light without motion", async () => {
    mockReduced = true;
    await renderFocus();
    expect(screen.queryByTestId(HORIZON_FOCUS_PART.BLOOM, hidden)).toBeNull();
  });
});
