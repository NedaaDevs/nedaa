import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AccessibilityInfo, StyleSheet } from "react-native";
import { useSegments } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { Toast, toastLabel } from "@/components/ui/toast";
import { HAPTIC_FEEDBACK } from "@/constants/Haptics";
import { SPRING } from "@/constants/Motion";
import {
  TOAST_EDGE,
  TOAST_HAPTIC,
  TOAST_MOTION,
  TOAST_SWIPE,
  type ToastKind,
} from "@/constants/Toast";
import { useHaptic } from "@/hooks/useHaptic";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useScreenReader } from "@/hooks/useScreenReader";
import { useTabBarFrameStore } from "@/stores/tabBarFrame";
import { useToastStore, type ShownToast } from "@/stores/toast";
import { toastBottom } from "@/utils/safeArea";
import { announcementFor, SWIPE, swipeOutcome, toastDwellMs } from "@/utils/toast";

export const TOAST_HOST_PART = { FRAME: "toast-frame" } as const;

/** Test ids for the host's gestures. */
export const TOAST_HOST_GESTURE = { SWIPE: "toast-swipe" } as const;

// The host plays its own Reduce Motion fade; Reanimated's rule would snap it.
const easeOut = (duration: number) => ({
  duration,
  easing: Easing.out(Easing.cubic),
  reduceMotion: ReduceMotion.Never,
});

const SETTLE = { ...SPRING.SETTLE, reduceMotion: ReduceMotion.Never };

/** A short drag lets go and the toast springs back into place. */
const SNAP_BACK = { ...SPRING.SNAP, reduceMotion: ReduceMotion.Never };

/** The one toast over every screen, clear of the tab bar and home indicator. */
export const ToastHost = () => {
  const { t } = useTranslation();
  const toast = useToastStore((state) => state.toast);
  const hide = useToastStore((state) => state.hide);
  const tabBarHeight = useTabBarFrameStore((state) => state.height);
  const segments = useSegments();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const screenReader = useScreenReader();
  const opacity = useSharedValue(0);
  const offset = useSharedValue(0);
  const feedback = {
    [HAPTIC_FEEDBACK.SUCCESS]: useHaptic(HAPTIC_FEEDBACK.SUCCESS),
    [HAPTIC_FEEDBACK.WARNING]: useHaptic(HAPTIC_FEEDBACK.WARNING),
    [HAPTIC_FEEDBACK.ERROR]: useHaptic(HAPTIC_FEEDBACK.ERROR),
  };
  const arriveHaptic = useEffectEvent((kind: ToastKind) => {
    const haptic = TOAST_HAPTIC[kind];
    if (haptic) void feedback[haptic]();
  });

  // The last toast felt and spoken.
  const arrived = useRef<ShownToast["id"] | null>(null);

  // The toast on screen; it outlives the store's while it plays its exit.
  const [shown, setShown] = useState<ShownToast | null>(toast);
  if (toast && toast.id !== shown?.id) setShown(toast);

  // A new toast arrives in place of any other, is spoken, and leaves on time.
  // It rises on the settle spring; under Reduce Motion it only fades.
  useEffect(() => {
    if (!toast) return;
    opacity.set(0);
    offset.set(reduced ? 0 : TOAST_MOTION.rise);
    opacity.set(withTiming(1, easeOut(reduced ? TOAST_MOTION.reducedMs : TOAST_MOTION.enterMs)));
    if (!reduced) offset.set(withSpring(0, SETTLE));
    // A setting change reruns this; the haptic and the announcement stay once.
    if (arrived.current !== toast.id) {
      arrived.current = toast.id;
      arriveHaptic(toast.kind);
      AccessibilityInfo.announceForAccessibilityWithOptions(
        toastLabel(t, toast.kind, toast.message),
        announcementFor(toast.kind)
      );
    }
    const timer = setTimeout(() => hide(toast.id), toastDwellMs(toast, screenReader));
    return () => clearTimeout(timer);
  }, [toast, reduced, screenReader, hide, t, opacity, offset]);

  // Once the store lets go, the last toast fades out from wherever it is.
  useEffect(() => {
    if (toast || !shown) return;
    const ms = reduced ? TOAST_MOTION.reducedMs : TOAST_MOTION.exitMs;
    opacity.set(withTiming(0, easeOut(ms)));
    if (!reduced) offset.set(withTiming(offset.get() + TOAST_MOTION.drop, easeOut(ms)));
    const timer = setTimeout(() => setShown(null), ms);
    return () => clearTimeout(timer);
  }, [toast, shown, reduced, opacity, offset]);

  const motion = useAnimatedStyle(() => ({
    opacity: opacity.get(),
    transform: [{ translateY: offset.get() }],
  }));

  if (!shown) return null;
  const dismiss = () => hide(shown.id);
  // Only while current: the leaving toast stays pressable through its exit.
  const action = shown.action && {
    label: shown.action.label,
    onPress: () => {
      if (useToastStore.getState().toast?.id !== shown.id) return;
      dismiss();
      shown.action?.onPress();
    },
  };

  // Down only: a drag follows the finger and fades; past the threshold it leaves.
  const swipe = Gesture.Pan()
    .withTestId(TOAST_HOST_GESTURE.SWIPE)
    .runOnJS(true)
    .activeOffsetY(TOAST_SWIPE.startAt)
    .failOffsetX([-TOAST_SWIPE.dismissAt, TOAST_SWIPE.dismissAt])
    .onChange(({ translationY }) => {
      const dy = Math.max(0, translationY);
      offset.set(dy);
      opacity.set(Math.max(TOAST_SWIPE.minOpacity, 1 - dy / TOAST_SWIPE.fadeOver));
    })
    .onEnd(({ translationY }) => {
      if (swipeOutcome(translationY) === SWIPE.DISMISS) return dismiss();
      offset.set(reduced ? 0 : withSpring(0, SNAP_BACK));
      opacity.set(withTiming(1, easeOut(TOAST_MOTION.enterMs)));
    });

  return (
    <Animated.View
      testID={TOAST_HOST_PART.FRAME}
      pointerEvents="box-none"
      style={[
        styles.frame,
        { bottom: toastBottom({ segments, tabBarHeight, insetBottom: insets.bottom }) },
        motion,
      ]}>
      <GestureDetector gesture={swipe}>
        <Animated.View>
          <Toast
            key={shown.id}
            kind={shown.kind}
            message={shown.message}
            action={action}
            onDismiss={dismiss}
          />
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  frame: { position: "absolute", start: TOAST_EDGE, end: TOAST_EDGE },
});
