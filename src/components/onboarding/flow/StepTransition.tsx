import { useEffect, useEffectEvent, type ReactNode } from "react";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import {
  ONBOARDING_PART,
  STEP_DIRECTION,
  STEP_MOTION,
  type StepDirection,
} from "@/constants/Onboarding";
import { useRTL } from "@/contexts/RTLContext";
import { useReducedMotion } from "@/hooks/useReducedMotion";

const CURVE = Easing.bezier(...STEP_MOTION.CURVE);
const FILL = { flex: 1 };
const TRANSPARENT = 0;
const OPAQUE = 1;

/** New content enters from the reading start, or from the end going back. */
export const enterOffset = (direction: StepDirection, isRTL: boolean) =>
  STEP_MOTION.ENTER_PX * direction * (isRTL ? 1 : -1);

/** How long the entry takes; going back under Reduce Motion is instant. */
export const enterMs = (direction: StepDirection, reduced: boolean) => {
  const forward = direction === STEP_DIRECTION.FORWARD;
  if (reduced) return forward ? STEP_MOTION.REDUCED_MS : 0;
  return forward ? STEP_MOTION.FORWARD_MS : STEP_MOTION.BACK_MS;
};

type Props = { direction: StepDirection; children: ReactNode };

/** One step's content, moved in along the reading direction; keyed by step. */
export const StepTransition = ({ direction, children }: Props) => {
  const { isRTL } = useRTL();
  const reduced = useReducedMotion();
  const instant = enterMs(direction, reduced) === 0;
  // Mounted at the entry state: the first frame never shows the step in place.
  const shift = useSharedValue(reduced ? 0 : enterOffset(direction, isRTL));
  const opacity = useSharedValue(instant ? OPAQUE : TRANSPARENT);

  // Once per mount: a language change does not replay the step shown.
  const enter = useEffectEvent(() => {
    const timing = { duration: enterMs(direction, reduced), easing: CURVE };
    if (!reduced) shift.set(withTiming(0, timing));
    if (!instant) opacity.set(withTiming(OPAQUE, timing));
  });
  useEffect(() => {
    enter();
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.get(),
    transform: [{ translateX: shift.get() }],
  }));

  return (
    <Animated.View testID={ONBOARDING_PART.TRANSITION} style={[FILL, style]}>
      {children}
    </Animated.View>
  );
};
