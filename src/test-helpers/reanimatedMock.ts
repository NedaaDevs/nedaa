import { useRef, useState } from "react";
import { View } from "react-native";

/** Reanimated without the worklets runtime jest lacks; Views keep the props. */
const Animated = { View };

export default Animated;

/** A shared value that lands an animation at once and redraws its readers. */
export const useSharedValue = <T>(initial: T) => {
  const [, redraw] = useState(0);
  const current = useRef(initial);
  const [box] = useState(() => ({
    get: () => current.current,
    set: (next: T) => {
      current.current = next;
      redraw((n) => n + 1);
    },
  }));
  return box;
};
export const useAnimatedStyle = <T>(style: () => T) => style();
export const withTiming = jest.fn((value: unknown) => value);
export const withSpring = jest.fn((value: unknown) => value);
export const withSequence = (...steps: unknown[]) => steps[steps.length - 1];
export const Easing = {
  out: (easing: unknown) => easing,
  inOut: (easing: unknown) => easing,
  cubic: (t: number) => t,
};

/** A layout transition's builder chain, kept as one object the tests can spot. */
export const LinearTransition = {
  duration: () => LinearTransition,
  easing: () => LinearTransition,
};
