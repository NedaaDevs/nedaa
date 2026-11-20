import { useEffect, type ReactNode } from "react";
import type { AccessibilityActionEvent, LayoutChangeEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { A11Y_ACTION, HIDDEN_FROM_READER } from "@/constants/Accessibility";
import { SPRING } from "@/constants/Motion";
import { useRTL } from "@/contexts/RTLContext";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/** Test ids for the parts a test reaches. */
export const SWIPE_TO_REMOVE_PART = {
  REMOVE: "swipe-to-remove-button",
  PAN: "swipe-to-remove-pan",
} as const;

/** Travel before a drag counts as a swipe, and past which a release opens it. */
const DRAG_START = 10;
const OPEN_PAST = 40;

type Props = {
  /** The remove control's text, and the reader's name for the action. */
  label: string;
  /** What the row reads as; the row is one element to a reader. */
  rowLabel: string;
  hint?: string;
  onRemove: () => void;
  children: ReactNode;
};

/** A row that slides toward its start edge to show a remove control behind it. */
export const SwipeToRemove = ({ label, rowLabel, hint, onRemove, children }: Props) => {
  const { isRTL } = useRTL();
  const reduced = useReducedMotion();
  const shift = useSharedValue(0);
  const rest = useSharedValue(0);
  const width = useSharedValue(0);
  // Worklets cannot read React context or hooks, so both live in shared values.
  const sign = useSharedValue(isRTL ? 1 : -1);
  const still = useSharedValue(reduced);
  useEffect(() => {
    sign.set(isRTL ? 1 : -1);
    still.set(reduced);
  }, [isRTL, reduced, sign, still]);

  const moveTo = (target: number) => {
    "worklet";
    rest.set(target);
    shift.set(still.get() ? target : withSpring(target, SPRING.SNAP));
  };

  const pan = Gesture.Pan()
    .withTestId(SWIPE_TO_REMOVE_PART.PAN)
    .activeOffsetX([-DRAG_START, DRAG_START])
    // A vertical move first hands the touch to the scrolling page.
    .failOffsetY([-DRAG_START, DRAG_START])
    .onUpdate(({ translationX }) => {
      const travel = (rest.get() + translationX) * sign.get();
      shift.set(Math.min(width.get(), Math.max(0, travel)) * sign.get());
    })
    // A cancelled drag returns the row to where it rested.
    .onEnd((_, success) => {
      if (!success) moveTo(rest.get());
      else moveTo(Math.abs(shift.get()) > OPEN_PAST ? width.get() * sign.get() : 0);
    });

  const slid = useAnimatedStyle(() => ({ transform: [{ translateX: shift.get() }] }));
  // Hidden at rest: the row's glass would show it through.
  const shown = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.abs(shift.get()) / OPEN_PAST),
  }));

  const remove = () => {
    moveTo(0);
    onRemove();
  };

  const onAction = ({ nativeEvent }: AccessibilityActionEvent) => {
    if (nativeEvent.actionName === A11Y_ACTION.REMOVE) onRemove();
  };

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={{ overflow: "hidden" }}>
        <Animated.View
          style={[{ position: "absolute", top: 0, bottom: 0, end: 0 }, shown]}
          onLayout={({ nativeEvent }: LayoutChangeEvent) => width.set(nativeEvent.layout.width)}>
          <Pressable
            testID={SWIPE_TO_REMOVE_PART.REMOVE}
            // The reader takes the row's action instead; this is the sighted path.
            {...HIDDEN_FROM_READER}
            onPress={remove}
            flex={1}
            minWidth="$target"
            paddingHorizontal="$group"
            alignItems="center"
            justifyContent="center"
            backgroundColor="$danger">
            <Text size="label" fontWeight="600" color="$typographyContrast">
              {label}
            </Text>
          </Pressable>
        </Animated.View>
        <Animated.View
          style={slid}
          accessible
          accessibilityLabel={rowLabel}
          accessibilityHint={hint}
          // The reader's custom action: the swipe, for anyone who cannot make it.
          accessibilityActions={[{ name: A11Y_ACTION.REMOVE, label }]}
          onAccessibilityAction={onAction}>
          {children}
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
};
