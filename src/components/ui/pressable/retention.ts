import { useRef } from "react";
import type { GestureResponderEvent, LayoutChangeEvent } from "react-native";

/** How far past its edge a held finger may drift before the hold lets go. */
export const RETENTION_SLOP = 20;

/**
 * Ends a hold when the finger slides off, which Tamagui's press events never do.
 * The finger is read against the view the touch began on, so the control's
 * children must not take touches.
 */
export const usePressRetention = (onLeave: () => void) => {
  const size = useRef({ width: 0, height: 0 });

  return {
    onLayout: ({ nativeEvent }: LayoutChangeEvent) => {
      size.current = nativeEvent.layout;
    },
    onResponderMove: ({ nativeEvent }: GestureResponderEvent) => {
      const { width, height } = size.current;
      const { locationX: x, locationY: y } = nativeEvent;
      const outside =
        x < -RETENTION_SLOP ||
        y < -RETENTION_SLOP ||
        x > width + RETENTION_SLOP ||
        y > height + RETENTION_SLOP;
      if (outside) onLeave();
    },
  };
};
