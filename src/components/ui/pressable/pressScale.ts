import type { TransitionKeys } from "tamagui";

import { useReducedMotion } from "@/hooks/useReducedMotion";

/** A pressed card or row shrinks a touch, then springs back. */
export const PRESS_SCALE = 0.98;

/** The scale goes down on a short timing, then springs back on the snap. */
const PRESS_DOWN = "press" satisfies TransitionKeys;
const PRESS_TRANSITION = "springSnap" satisfies TransitionKeys;

/** Only the scale animates; colour and size changes land at once. */
const PRESS_ANIMATES = ["transform"];

type PressScale = {
  pressStyle: { scale?: number; transition?: typeof PRESS_DOWN };
  transition: typeof PRESS_TRANSITION;
  animateOnly: string[];
};

/** Props a pressable surface spreads on; reduced motion leaves no scale to run. */
export const usePressScale = (): PressScale => {
  const reduced = useReducedMotion();
  return {
    pressStyle: reduced ? {} : { scale: PRESS_SCALE, transition: PRESS_DOWN },
    transition: PRESS_TRANSITION,
    animateOnly: PRESS_ANIMATES,
  };
};
