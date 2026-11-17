import { useEffect } from "react";
import { View } from "react-native";
import { act, render } from "@testing-library/react-native";
import { withTiming } from "react-native-reanimated";
import { GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import { createGestureController } from "react-native-gesture-handler/jest-utils";

import { FOCUS_GESTURE, FOCUS_MOTION, STEP } from "@/constants/AthkarFocus";
import { HAPTIC_FEEDBACK } from "@/constants/Haptics";
import {
  FOCUS_GESTURE_ID,
  useFocusGesture,
  type FocusGesture,
  type FocusGestureOptions,
} from "@/hooks/useFocusGesture";
import { clearHaptics, firedHaptics } from "@/test-helpers/hapticMock";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("@/hooks/useHaptic", () => jest.requireActual("@/test-helpers/hapticMock"));

const WIDTH = 400;
const HOLD_LANDS_MS = FOCUS_GESTURE.HOLD_DELAY_MS + FOCUS_GESTURE.HOLD_BUILD_MS;

const handlers = () => ({
  onTouch: jest.fn(),
  onTap: jest.fn(),
  onStep: jest.fn(),
  onEdge: jest.fn(),
  onUndo: jest.fn(),
  onHold: jest.fn(),
});

let on: ReturnType<typeof handlers>;
let latest: FocusGesture;

const Probe = (options: Partial<FocusGestureOptions>) => {
  const gesture = useFocusGesture({
    index: 1,
    width: WIDTH,
    rtl: false,
    reduceMotion: false,
    canTap: true,
    canPrevious: true,
    canNext: true,
    canUndo: true,
    holdRoom: FOCUS_GESTURE.HOLD_ADD,
    scrollZone: null,
    ...on,
    ...options,
  });
  useEffect(() => {
    latest = gesture;
  });
  return (
    <GestureHandlerRootView>
      <GestureDetector gesture={gesture.gesture}>
        <View />
      </GestureDetector>
    </GestureHandlerRootView>
  );
};

const mount = async (options: Partial<FocusGestureOptions> = {}) => {
  const view = await render(<Probe {...options} />);
  return { ...view, touch: createGestureController(FOCUS_GESTURE_ID) };
};
type Touch = Awaited<ReturnType<typeof mount>>["touch"];

const wait = (ms: number) => act(() => jest.advanceTimersByTime(ms));
// The controller's own default for a pan is a touch that has moved.
const STILL = { translationX: 0, translationY: 0, velocityX: 0, velocityY: 0, y: 0 };
const x = (translationX: number) => ({ ...STILL, translationX });
const y = (translationY: number) => ({ ...STILL, translationY });
type At = typeof STILL;

/** A still touch, lifted after `ms`. */
const press = async (touch: Touch, ms: number) => {
  await act(() => touch.begin(STILL));
  await wait(ms);
  await act(() => touch.fail(STILL));
};
const dragTo = async (touch: Touch, at: At) => {
  await act(() => touch.activate(at));
  await act(() => touch.update(at));
};
/** A drag to `at`, lifted there. */
const drag = async (touch: Touch, at: At) => {
  await act(() => touch.begin(STILL));
  await wait(50);
  await dragTo(touch, at);
  await act(() => touch.end(at));
};

beforeEach(() => {
  jest.useFakeTimers();
  clearHaptics();
  on = handlers();
});
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe("useFocusGesture", () => {
  test("a quick still touch counts once", async () => {
    const { touch } = await mount();
    await press(touch, 100);
    expect(on.onTap).toHaveBeenCalledTimes(1);
    expect(on.onHold).not.toHaveBeenCalled();
    expect(firedHaptics()).toEqual([HAPTIC_FEEDBACK.LIGHT]);
  });

  test("every touch reports itself", async () => {
    const { touch } = await mount();
    await press(touch, 100);
    await drag(touch, x(-200));
    expect(on.onTouch).toHaveBeenCalledTimes(2);
  });

  test("a touch lifted between the tap time and the hold adds nothing", async () => {
    const { touch } = await mount();
    await press(touch, 400);
    expect(on.onTap).not.toHaveBeenCalled();
    expect(on.onHold).not.toHaveBeenCalled();
    await wait(HOLD_LANDS_MS);
    expect(on.onHold).not.toHaveBeenCalled();
    expect(firedHaptics()).toEqual([]);
  });

  test("a hold lands once and its release adds nothing", async () => {
    const { touch } = await mount({ holdRoom: 3 });
    await act(() => touch.begin(STILL));
    await wait(FOCUS_GESTURE.HOLD_DELAY_MS);
    expect(latest.holding).toBe(true);
    expect(on.onHold).not.toHaveBeenCalled();
    await wait(FOCUS_GESTURE.HOLD_BUILD_MS);
    expect(on.onHold).toHaveBeenCalledTimes(1);
    expect(on.onHold).toHaveBeenCalledWith(3);
    expect(latest.holding).toBe(false);
    expect(firedHaptics()).toEqual([HAPTIC_FEEDBACK.HEAVY]);
    await wait(1000);
    await act(() => touch.fail(STILL));
    expect(on.onHold).toHaveBeenCalledTimes(1);
    expect(on.onTap).not.toHaveBeenCalled();
  });

  test("a hold does not start with no room to add", async () => {
    const { touch } = await mount({ holdRoom: 0 });
    await act(() => touch.begin(STILL));
    await wait(HOLD_LANDS_MS);
    expect(latest.holding).toBe(false);
    expect(on.onHold).not.toHaveBeenCalled();
  });

  test("moving cancels a hold that has started", async () => {
    const { touch } = await mount();
    await act(() => touch.begin(STILL));
    await wait(FOCUS_GESTURE.HOLD_DELAY_MS + 100);
    expect(latest.holding).toBe(true);
    await dragTo(touch, x(-20));
    expect(latest.holding).toBe(false);
    await wait(HOLD_LANDS_MS);
    expect(on.onHold).not.toHaveBeenCalled();
  });

  test("a drag toward the start edge opens the next dhikr", async () => {
    const { touch } = await mount();
    await drag(touch, x(-0.6 * WIDTH));
    expect(on.onStep).toHaveBeenCalledWith(STEP.NEXT);
    expect(on.onTap).not.toHaveBeenCalled();
    expect(firedHaptics()).toEqual([HAPTIC_FEEDBACK.SELECTION]);
  });

  test("a drag to the right opens the next dhikr in a right-to-left layout", async () => {
    const { touch } = await mount({ rtl: true });
    await drag(touch, x(0.6 * WIDTH));
    expect(on.onStep).toHaveBeenCalledWith(STEP.NEXT);
  });

  test("a short side drag goes back with no step and no haptic", async () => {
    const { touch } = await mount();
    await drag(touch, x(-0.2 * WIDTH));
    expect(on.onStep).not.toHaveBeenCalled();
    expect(latest.offset.get()).toBe(-WIDTH);
    expect(firedHaptics()).toEqual([]);
  });

  test("the text follows a side drag", async () => {
    const { touch } = await mount();
    await act(() => touch.begin(STILL));
    await dragTo(touch, x(-50));
    expect(latest.offset.get()).toBe(-WIDTH - 50);
  });

  test("a drag past the last dhikr resists and reports the edge", async () => {
    const { touch } = await mount({ canNext: false });
    await act(() => touch.begin(STILL));
    await dragTo(touch, x(-200));
    expect(latest.offset.get()).toBe(-WIDTH - 200 * FOCUS_GESTURE.EDGE_RESISTANCE);
    await act(() => touch.end(x(-200)));
    expect(on.onStep).not.toHaveBeenCalled();
    expect(on.onEdge).toHaveBeenCalledWith(STEP.NEXT);
    expect(firedHaptics()).toEqual([HAPTIC_FEEDBACK.MEDIUM]);
  });

  test("a drag down past the undo distance arms, then undoes on the lift", async () => {
    const { touch } = await mount();
    await act(() => touch.begin(STILL));
    await dragTo(touch, y(FOCUS_GESTURE.UNDO_AT + 6));
    expect(latest.undoArmed).toBe(true);
    await act(() => touch.end(y(FOCUS_GESTURE.UNDO_AT + 6)));
    expect(on.onUndo).toHaveBeenCalledTimes(1);
    expect(latest.undoArmed).toBe(false);
    expect(firedHaptics()).toEqual([HAPTIC_FEEDBACK.LIGHT]);
  });

  test("an upward drag does nothing", async () => {
    const { touch } = await mount();
    await drag(touch, y(-120));
    expect(Object.values(on).filter((fn) => fn !== on.onTouch && fn.mock.calls.length)).toEqual([]);
  });

  test("with the count closed nothing changes by hand, and a step still works", async () => {
    const { touch } = await mount({ canTap: false, canUndo: false, holdRoom: 0 });
    await press(touch, 100);
    await act(() => touch.begin(STILL));
    await wait(HOLD_LANDS_MS);
    await act(() => touch.fail(STILL));
    await act(() => touch.begin(STILL));
    await dragTo(touch, y(FOCUS_GESTURE.UNDO_AT + 6));
    expect(latest.undoArmed).toBe(false);
    await act(() => touch.end(y(FOCUS_GESTURE.UNDO_AT + 6)));
    expect(on.onTap).not.toHaveBeenCalled();
    expect(on.onHold).not.toHaveBeenCalled();
    expect(on.onUndo).not.toHaveBeenCalled();
    expect(firedHaptics()).toEqual([]);
    await drag(touch, x(-0.6 * WIDTH));
    expect(on.onStep).toHaveBeenCalledWith(STEP.NEXT);
  });

  test("a short flick toward the start edge opens the next dhikr", async () => {
    const { touch } = await mount();
    const at = x(-(FOCUS_GESTURE.FLICK_MIN + 6));
    await act(() => touch.begin(STILL));
    await dragTo(touch, at);
    await act(() => touch.end({ ...at, velocityX: -(FOCUS_GESTURE.FLICK_VELOCITY + 100) }));
    expect(on.onStep).toHaveBeenCalledWith(STEP.NEXT);
  });

  test("a short downward flick undoes", async () => {
    const { touch } = await mount();
    const at = y(FOCUS_GESTURE.UNDO_FLICK_MIN + 4);
    await act(() => touch.begin(STILL));
    await dragTo(touch, at);
    expect(latest.undoArmed).toBe(false);
    await act(() => touch.end({ ...at, velocityY: FOCUS_GESTURE.FLICK_VELOCITY + 100 }));
    expect(on.onUndo).toHaveBeenCalledTimes(1);
  });

  test("a hold lands at the end of its build, not before", async () => {
    const { touch } = await mount();
    await act(() => touch.begin(STILL));
    await wait(HOLD_LANDS_MS - 1);
    expect(on.onHold).not.toHaveBeenCalled();
    await wait(1);
    expect(on.onHold).toHaveBeenCalledTimes(1);
  });

  test("with Reduce Motion the row stays and the drag is still measured", async () => {
    const { touch } = await mount({ reduceMotion: true });
    await act(() => touch.begin(STILL));
    await dragTo(touch, x(-50));
    expect(latest.offset.get()).toBe(-WIDTH);
    expect(latest.side.get()).toBe(-50);
    await act(() => touch.end(x(-0.6 * WIDTH)));
    expect(on.onStep).toHaveBeenCalledWith(STEP.NEXT);
  });

  test("a drag the system takes away does nothing", async () => {
    const { touch } = await mount();
    await act(() => touch.begin(STILL));
    await dragTo(touch, x(-0.6 * WIDTH));
    await act(() => touch.cancel(x(-0.6 * WIDTH)));
    expect(on.onStep).not.toHaveBeenCalled();
    expect(latest.offset.get()).toBe(-WIDTH);
    expect(firedHaptics()).toEqual([]);
  });

  test("a drag released after the place moved under it does not step", async () => {
    const { touch, rerender } = await mount({ index: 1 });
    await act(() => touch.begin(STILL));
    await dragTo(touch, x(-0.6 * WIDTH));
    await rerender(<Probe index={2} />);
    await act(() => touch.end(x(-0.6 * WIDTH)));
    expect(on.onStep).not.toHaveBeenCalled();
    expect(latest.offset.get()).toBe(-2 * WIDTH);
  });

  test("a hold does not land after the place moved under it", async () => {
    const { touch, rerender } = await mount({ index: 1 });
    await act(() => touch.begin(STILL));
    await wait(FOCUS_GESTURE.HOLD_DELAY_MS);
    await rerender(<Probe index={2} />);
    await wait(FOCUS_GESTURE.HOLD_BUILD_MS);
    expect(on.onHold).not.toHaveBeenCalled();
    expect(latest.holding).toBe(false);
    await act(() => touch.fail(STILL));
    expect(on.onTap).not.toHaveBeenCalled();
  });

  test("the row rests on the current dhikr, mirrored right to left", async () => {
    await mount({ index: 2 });
    expect(latest.offset.get()).toBe(-2 * WIDTH);
    await mount({ index: 2, rtl: true });
    expect(latest.offset.get()).toBe(2 * WIDTH);
  });

  test("the row glides one dhikr over", async () => {
    const { rerender } = await mount({ index: 1 });
    await rerender(<Probe index={2} />);
    expect(latest.offset.get()).toBe(-2 * WIDTH);
    expect(withTiming).toHaveBeenCalledWith(
      -2 * WIDTH,
      expect.objectContaining({ duration: FOCUS_MOTION.GLIDE_MS })
    );
  });

  test("a dhikr further away arrives with a fade", async () => {
    const { rerender } = await mount({ index: 1 });
    jest.mocked(withTiming).mockClear();
    await rerender(<Probe index={3} />);
    expect(latest.offset.get()).toBe(-3 * WIDTH);
    expect(withTiming).toHaveBeenCalledWith(1, { duration: FOCUS_MOTION.FADE_MS });
    expect(withTiming).not.toHaveBeenCalledWith(-3 * WIDTH, expect.anything());
  });

  test("a drag down that starts on scrolling text does not undo", async () => {
    const { touch } = await mount({ scrollZone: { top: 100, bottom: 300 } });
    const onText = { ...y(FOCUS_GESTURE.UNDO_AT + 6), y: 200 };
    await act(() => touch.begin({ ...STILL, y: 200 }));
    await dragTo(touch, onText);
    expect(latest.undoArmed).toBe(false);
    await act(() => touch.end(onText));
    expect(on.onUndo).not.toHaveBeenCalled();
  });

  test("a drag down that starts under scrolling text undoes", async () => {
    const { touch } = await mount({ scrollZone: { top: 100, bottom: 300 } });
    const under = { ...y(FOCUS_GESTURE.UNDO_AT + 6), y: 400 };
    await act(() => touch.begin({ ...STILL, y: 400 }));
    await dragTo(touch, under);
    await act(() => touch.end(under));
    expect(on.onUndo).toHaveBeenCalledTimes(1);
  });

  test("leaving mid-hold adds nothing", async () => {
    const { touch, unmount } = await mount();
    await act(() => touch.begin(STILL));
    await wait(FOCUS_GESTURE.HOLD_DELAY_MS);
    await unmount();
    await wait(HOLD_LANDS_MS);
    expect(on.onHold).not.toHaveBeenCalled();
  });
});
