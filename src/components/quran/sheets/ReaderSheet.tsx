import { Pressable, StyleSheet } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { YStack } from "tamagui";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { QURAN_THEME_COLORS } from "@/constants/Quran";
import { QuranTheme } from "@/enums/quran";

interface ReaderSheetProps {
  onClose: () => void;
  quranTheme: QuranTheme;
  children: React.ReactNode;
}

// Reusable bottom sheet for the reader: paper-themed, fade backdrop, swipe-down to
// dismiss, and a plain timing slide (no spring — the springified bounce looks bad
// on Android). The parent mounts/unmounts it; reanimated plays enter/exit.
const ReaderSheet = ({ onClose, quranTheme, children }: ReaderSheetProps) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const c = QURAN_THEME_COLORS[quranTheme];
  const translateY = useSharedValue(0);

  const dragStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));

  // Swipe down past a threshold to dismiss. The worklet shared-value mutations
  // trip react-compiler's immutability rule (false positive for reanimated).
  const pan = Gesture.Pan()
    .onUpdate((e) => {
      "worklet";
      // eslint-disable-next-line react-hooks/immutability
      translateY.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      "worklet";
      if (e.translationY > 120) {
        runOnJS(onClose)();
        return;
      }
      // eslint-disable-next-line react-hooks/immutability
      translateY.value = withTiming(0, { duration: 180 });
    });

  return (
    <>
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

      <Animated.View
        entering={reduceMotion ? FadeIn.duration(150) : SlideInDown.duration(260)}
        exiting={reduceMotion ? FadeOut.duration(150) : SlideOutDown.duration(220)}
        style={[
          styles.sheet,
          dragStyle,
          { backgroundColor: c.background, paddingBottom: insets.bottom + 16 },
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
});

export default ReaderSheet;
