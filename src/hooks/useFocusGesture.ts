import { useEffect, useRef, useState } from "react";
import { usePanGesture, type PanGesture } from "react-native-gesture-handler";
import { Easing, useSharedValue, withTiming, type SharedValue } from "react-native-reanimated";

import {
  FOCUS_GESTURE,
  FOCUS_MODE,
  FOCUS_MOTION,
  FOCUS_OUTCOME,
  STEP,
  type FocusMode,
  type StepDirection,
} from "@/constants/AthkarFocus";
import { HAPTIC_FEEDBACK } from "@/constants/Haptics";
import { SHEET_CURVE } from "@/constants/Motion";
import { useHaptic } from "@/hooks/useHaptic";
import { lockMode, nextSign, releaseOutcome, slotX, undoArmed } from "@/utils/focusGesture";

export const FOCUS_GESTURE_ID = "athkar-focus-gesture";

export type FocusGestureOptions = {
  /** The current dhikr's place in the session. */
  index: number;
  width: number;
  rtl: boolean;
  reduceMotion: boolean;
  canPrevious: boolean;
  canNext: boolean;
  /** False while audio owns the count; so are `canUndo` and `holdRoom`. */
  canTap: boolean;
  canUndo: boolean;
  /** What a hold would add; a hold needs room. */
  holdRoom: number;
  /** Where long text scrolls, in the surface's y; a drag down there scrolls. */
  scrollZone: { top: number; bottom: number } | null;
  onTouch: () => void;
  onTap: () => void;
  onStep: (by: StepDirection) => void;
  /** A step the session has no dhikr for. */
  onEdge: (by: StepDirection) => void;
  onUndo: () => void;
  onHold: (by: number) => void;
};

export type FocusGesture = {
  gesture: PanGesture;
  /** The row's x: dhikr `i` sits `i` widths toward the end edge. */
  offset: SharedValue<number>;
  /** The side drag's distance, signed. */
  side: SharedValue<number>;
  /** The downward drag's distance. */
  down: SharedValue<number>;
  /** 0 to 1 as a hold builds. */
  hold: SharedValue<number>;
  /** 0 to 1 as a dhikr that did not slide in arrives. */
  arrive: SharedValue<number>;
  holding: boolean;
  undoArmed: boolean;
};

const glide = { duration: FOCUS_MOTION.GLIDE_MS, easing: Easing.bezier(...SHEET_CURVE) };
const back = { duration: FOCUS_MOTION.BACK_MS, easing: Easing.bezier(...FOCUS_MOTION.BACK_CURVE) };
const fade = { duration: FOCUS_MOTION.FADE_MS };
const drain = { duration: FOCUS_MOTION.DRAIN_MS };
/** A touch's movement and speed. */
const AT_REST = { dx: 0, dy: 0, vx: 0, vy: 0 };

const build = { duration: FOCUS_GESTURE.HOLD_BUILD_MS, easing: Easing.linear };

/** One touch on the Focus screen: a tap, a hold, a side drag or a drag down. */
export const useFocusGesture = (options: FocusGestureOptions): FocusGesture => {
  const { index, width, rtl, reduceMotion, canPrevious, canNext, canTap, canUndo, holdRoom } =
    options;
  const { scrollZone } = options;
  const { onTouch, onTap, onStep, onEdge, onUndo, onHold } = options;

  const rest = -slotX(index, width, rtl);
  const offset = useSharedValue(rest);
  const side = useSharedValue(0);
  const down = useSharedValue(0);
  const hold = useSharedValue(0);
  const arrive = useSharedValue(1);
  const [holding, setHolding] = useState(false);
  const [armed, setArmed] = useState(false);

  const mode = useRef<FocusMode>(FOCUS_MODE.PENDING);
  const startedAt = useRef(0);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shownIndex = useRef(index);
  // The place a touch began on; audio can move it under the finger.
  const beganOn = useRef(index);
  const taken = useRef(false);
  const onScroll = useRef(false);
  // A lift reports no movement: the last drag sample is kept for it.
  const moved = useRef(AT_REST);

  const tapHaptic = useHaptic(HAPTIC_FEEDBACK.LIGHT);
  const stepHaptic = useHaptic(HAPTIC_FEEDBACK.SELECTION);
  const edgeHaptic = useHaptic(HAPTIC_FEEDBACK.MEDIUM);
  const holdHaptic = useHaptic(HAPTIC_FEEDBACK.HEAVY);

  // One step glides; a longer move, or Reduce Motion, arrives with a fade.
  useEffect(() => {
    const moved = Math.abs(index - shownIndex.current);
    shownIndex.current = index;
    if (moved === 1 && !reduceMotion) {
      offset.set(withTiming(rest, glide));
      return;
    }
    offset.set(rest);
    if (moved === 0) return;
    arrive.set(0);
    arrive.set(withTiming(1, fade));
  }, [index, rest, reduceMotion, offset, arrive]);

  const stopHold = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = null;
    hold.set(withTiming(0, drain));
    setHolding(false);
  };
  useEffect(
    () => () => {
      if (holdTimer.current) clearTimeout(holdTimer.current);
    },
    []
  );

  const landHold = () => {
    const moved = shownIndex.current !== beganOn.current;
    mode.current = moved ? FOCUS_MODE.DEAD : FOCUS_MODE.HELD;
    stopHold();
    if (moved) return;
    void holdHaptic();
    onHold(holdRoom);
  };
  const startHold = () => {
    setHolding(true);
    hold.set(withTiming(1, build));
    holdTimer.current = setTimeout(landHold, FOCUS_GESTURE.HOLD_BUILD_MS);
  };

  const settle = () => {
    side.set(withTiming(0, fade));
    down.set(reduceMotion ? 0 : withTiming(0, back));
    // A step that moves the place is glided to by the effect above.
    offset.set(reduceMotion ? rest : withTiming(rest, back));
    setArmed(false);
  };

  const gesture = usePanGesture({
    testID: FOCUS_GESTURE_ID,
    runOnJS: true,
    minDistance: FOCUS_GESTURE.SLOP,
    onBegin: ({ y }) => {
      mode.current = FOCUS_MODE.PENDING;
      moved.current = AT_REST;
      beganOn.current = index;
      taken.current = false;
      onScroll.current = scrollZone !== null && y >= scrollZone.top && y <= scrollZone.bottom;
      startedAt.current = Date.now();
      onTouch();
      if (holdRoom > 0) {
        holdTimer.current = setTimeout(startHold, FOCUS_GESTURE.HOLD_DELAY_MS);
      }
    },
    onUpdate: ({ translationX: dx, translationY: dy, velocityX: vx, velocityY: vy }) => {
      moved.current = { dx, dy, vx, vy };
      if (mode.current === FOCUS_MODE.PENDING) {
        const locked = lockMode(dx, dy);
        mode.current = locked === FOCUS_MODE.DOWN && onScroll.current ? FOCUS_MODE.DEAD : locked;
        if (mode.current !== FOCUS_MODE.PENDING) stopHold();
      }
      if (mode.current === FOCUS_MODE.SIDE) {
        side.set(dx);
        if (reduceMotion) return;
        const open = Math.sign(dx) === nextSign(rtl) ? canNext : canPrevious;
        offset.set(rest + (open ? dx : dx * FOCUS_GESTURE.EDGE_RESISTANCE));
      }
      if (mode.current === FOCUS_MODE.DOWN) {
        down.set(Math.max(0, dy));
        setArmed(canUndo && undoArmed(dy));
      }
    },
    onDeactivate: (lift) => {
      const { translationX: dx, translationY: dy, velocityX: vx, velocityY: vy } = lift;
      moved.current = { dx, dy, vx, vy };
      taken.current = lift.canceled;
    },
    onFinalize: () => {
      const { dx, dy, vx, vy } = moved.current;
      // A drag the system took, or one the place moved under, does nothing.
      const dropped = taken.current || index !== beganOn.current;
      const outcome = dropped
        ? FOCUS_OUTCOME.NONE
        : releaseOutcome({
            mode: mode.current,
            dx,
            dy,
            vx,
            vy,
            elapsedMs: Date.now() - startedAt.current,
            width,
            rtl,
            canPrevious,
            canNext,
            canTap,
            canUndo,
          });
      if (mode.current !== FOCUS_MODE.HELD) stopHold();
      settle();
      switch (outcome) {
        case FOCUS_OUTCOME.TAP:
          void tapHaptic();
          return onTap();
        case FOCUS_OUTCOME.NEXT:
          void stepHaptic();
          return onStep(STEP.NEXT);
        case FOCUS_OUTCOME.PREVIOUS:
          void stepHaptic();
          return onStep(STEP.PREVIOUS);
        case FOCUS_OUTCOME.UNDO:
          void tapHaptic();
          return onUndo();
        case FOCUS_OUTCOME.EDGE_NEXT:
          void edgeHaptic();
          return onEdge(STEP.NEXT);
        case FOCUS_OUTCOME.EDGE_PREVIOUS:
          void edgeHaptic();
          return onEdge(STEP.PREVIOUS);
        case FOCUS_OUTCOME.NONE:
          return undefined;
        default: {
          const unhandled: never = outcome;
          throw new Error(`unhandled focus outcome: ${String(unhandled)}`);
        }
      }
    },
  });

  return { gesture, offset, side, down, hold, arrive, holding, undoArmed: armed };
};
