import { useRef, useState } from "react";
import { View } from "react-native";

/** Reanimated without the worklets runtime jest lacks; Views keep the props. */
const Animated = {
  View,
  // Gesture Handler wraps its detector's child through this at import.
  createAnimatedComponent: <T>(component: T) => component,
};

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
/** Gesture Handler's detector asks for these; jest-utils drives callbacks. */
export const useEvent = () => () => undefined;
export const useComposedEventHandler = () => () => undefined;
export const withTiming = jest.fn((value: unknown) => value);
// Linear between the first and last points, clamped to the output range.
export const interpolate = (value: number, input: number[], output: number[]) => {
  const [inFrom, inTo] = [input[0], input[input.length - 1]];
  const [outFrom, outTo] = [output[0], output[output.length - 1]];
  const t = inTo === inFrom ? 0 : Math.min(1, Math.max(0, (value - inFrom) / (inTo - inFrom)));
  return outFrom + (outTo - outFrom) * t;
};
export const withSpring = jest.fn((value: unknown) => value);
export const withSequence = (...steps: unknown[]) => steps[steps.length - 1];
export const withRepeat = jest.fn((animation: unknown) => animation);
export const cancelAnimation = jest.fn();
export const ReduceMotion = { System: "system", Always: "always", Never: "never" } as const;
export const Easing = {
  out: (easing: unknown) => easing,
  inOut: (easing: unknown) => easing,
  cubic: (t: number) => t,
  linear: (t: number) => t,
  bezier: (...points: number[]) => ({ bezier: points }),
};

/** A layout transition's builder chain, kept as one object the tests can spot. */
export const LinearTransition = {
  duration: () => LinearTransition,
  easing: () => LinearTransition,
};

/** Motion on, so an entering animation is built; the View ignores it. */
export const useReducedMotion = () => false;

/** An entering animation's builder chain. */
export const FadeInDown = {
  duration: () => FadeInDown,
  delay: () => FadeInDown,
};
