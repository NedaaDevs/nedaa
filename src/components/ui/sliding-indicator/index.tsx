import { useEffect, useRef } from "react";
import { StyleSheet, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

import { SPRING } from "@/constants/Motion";
import { useRTL } from "@/contexts/RTLContext";
import { useReducedMotion } from "@/hooks/useReducedMotion";

type SlidingIndicatorProps = {
  testID: string;
  /** The chosen item's place among `count` equal items. */
  index: number;
  count: number;
  /** The track's measured width. */
  trackWidth: number;
  /** The track's padding around its items. */
  inset: number;
  /** The space between neighbouring items. */
  gap: number;
  /** The mark's look: fill, corners, shadow. */
  style?: ViewStyle;
};

/** A mark under the chosen item, placed from the start edge. */
export const SlidingIndicator = ({
  testID,
  index,
  count,
  trackWidth,
  inset,
  gap,
  style,
}: SlidingIndicatorProps) => {
  const { isRTL } = useRTL();
  const reduced = useReducedMotion();
  const width = (trackWidth - 2 * inset - gap * (count - 1)) / count;
  const offset = index * (width + gap);
  // Subtracting from 0 keeps the first item at 0, never -0.
  const target = isRTL ? 0 - offset : offset;
  const x = useSharedValue(target);
  // Null until first placed, so the first placement jumps.
  const placedWidth = useRef<number | null>(null);

  useEffect(() => {
    // A new width places the mark at once; only a new choice slides it.
    const resized = placedWidth.current !== width;
    placedWidth.current = width;
    x.set(reduced || resized ? target : withSpring(target, SPRING.SNAP));
  }, [target, width, reduced, x]);

  const slide = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));

  return (
    <Animated.View
      testID={testID}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.mark, { top: inset, bottom: inset, start: inset, width }, style, slide]}
    />
  );
};

const styles = StyleSheet.create({ mark: { position: "absolute" } });
