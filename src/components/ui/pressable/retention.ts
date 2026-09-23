import { useRef } from "react";
import type { GestureResponderEvent, LayoutChangeEvent } from "react-native";

/** How far past its edge a held finger may drift before the hold lets go. */
export const RETENTION_SLOP = 20;

/**
 * Ends a hold when the finger slides off, which Tamagui's press events never do.
 * The control's origin is taken at touch-down, while the finger is still on it,
 * and each move is read in page coordinates from there: Android reports a move's
 * `locationX` against the view under the finger, not the control. The control's
 * children must not take touches, or the origin is read off a child.
 */
export const usePressRetention = (onLeave: () => void) => {
  const size = useRef({ width: 0, height: 0 });
  const origin = useRef({ x: 0, y: 0 });

  return {
    onLayout: ({ nativeEvent }: LayoutChangeEvent) => {
      size.current = nativeEvent.layout;
    },
    onResponderGrant: ({ nativeEvent }: GestureResponderEvent) => {
      origin.current = {
        x: nativeEvent.pageX - nativeEvent.locationX,
        y: nativeEvent.pageY - nativeEvent.locationY,
      };
    },
    onResponderMove: ({ nativeEvent }: GestureResponderEvent) => {
      const { width, height } = size.current;
      const x = nativeEvent.pageX - origin.current.x;
      const y = nativeEvent.pageY - origin.current.y;
      const outside =
        x < -RETENTION_SLOP ||
        y < -RETENTION_SLOP ||
        x > width + RETENTION_SLOP ||
        y > height + RETENTION_SLOP;
      if (outside) onLeave();
    },
  };
};
