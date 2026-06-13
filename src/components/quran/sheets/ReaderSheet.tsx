import { useEffect } from "react";
import { Keyboard, Platform, Pressable, StyleSheet, useWindowDimensions } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  ZoomIn,
  ZoomOut,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { YStack } from "tamagui";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { QURAN_THEME_COLORS } from "@/constants/Quran";
import { QuranTheme } from "@/enums/quran";
import { LARGE_DEVICE_MIN_DP } from "@/utils/readerSpread";

interface ReaderSheetProps {
  onClose: () => void;
  quranTheme: QuranTheme;
  children: React.ReactNode;
}

// Paper-themed reader surface: bottom sheet on phones, centered popover on large devices.
const ReaderSheet = ({ onClose, quranTheme, children }: ReaderSheetProps) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { width, height } = useWindowDimensions();
  const isLarge = Math.min(width, height) >= LARGE_DEVICE_MIN_DP;
  const c = QURAN_THEME_COLORS[quranTheme];
  const translateY = useSharedValue(0);
  // Lift the bottom-anchored sheet above the keyboard (e.g. the highlight-rename
  // input) — RN doesn't reposition absolute views for the keyboard on its own.
  const keyboardOffset = useSharedValue(0);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const show = Keyboard.addListener(showEvent, (e) => {
      keyboardOffset.value = withTiming(e.endCoordinates.height, { duration: 220 });
    });
    const hide = Keyboard.addListener(hideEvent, () => {
      keyboardOffset.value = withTiming(0, { duration: 220 });
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, [keyboardOffset]);

  const dragStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value - keyboardOffset.value }],
  }));

  // Swipe down past a threshold to dismiss (bottom sheet only).
  const pan = Gesture.Pan()
    .onUpdate((e) => {
      "worklet";
      translateY.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      "worklet";
      if (e.translationY > 120) {
        scheduleOnRN(onClose);
        return;
      }
      translateY.value = withTiming(0, { duration: 180 });
    });

  const backdrop = (
    <Animated.View
      entering={FadeIn.duration(180)}
      exiting={FadeOut.duration(160)}
      style={styles.backdrop}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t("common.close")}
      />
    </Animated.View>
  );

  if (isLarge) {
    return (
      <>
        {backdrop}
        <Animated.View style={styles.centerWrap} pointerEvents="box-none">
          <Animated.View
            entering={reduceMotion ? FadeIn.duration(150) : ZoomIn.duration(200)}
            exiting={reduceMotion ? FadeOut.duration(150) : ZoomOut.duration(160)}
            style={[styles.popover, { backgroundColor: c.background }]}>
            {children}
          </Animated.View>
        </Animated.View>
      </>
    );
  }

  return (
    <>
      {backdrop}
      <Animated.View
        entering={reduceMotion ? FadeIn.duration(150) : SlideInDown.duration(260)}
        exiting={reduceMotion ? FadeOut.duration(150) : SlideOutDown.duration(220)}
        style={[
          styles.sheet,
          dragStyle,
          // Floor the inset: Android gesture-nav can report a tiny/zero bottom
          // inset, which left the last row under the home indicator.
          { backgroundColor: c.background, paddingBottom: Math.max(insets.bottom, 16) + 16 },
        ]}>
        <GestureDetector gesture={pan}>
          <YStack alignItems="center" paddingTop="$2.5" paddingBottom="$1.5">
            <YStack
              width={44}
              height={4}
              borderRadius={2}
              backgroundColor={c.frameColor}
              opacity={0.4}
            />
          </YStack>
        </GestureDetector>
        {children}
      </Animated.View>
    </>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 18,
  },
  centerWrap: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  popover: {
    width: "90%",
    maxWidth: 480,
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 18,
  },
});

export default ReaderSheet;
