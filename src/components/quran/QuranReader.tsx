import { useCallback } from "react";
import { useWindowDimensions, StyleSheet } from "react-native";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { MushafVersion, QuranTheme } from "@/enums/quran";
import { TOTAL_PAGES } from "@/constants/Quran";
import QuranPage from "@/components/quran/QuranPage";

interface QuranReaderProps {
  currentPage: number;
  version: MushafVersion;
  quranTheme: QuranTheme;
  onPageChange: (page: number) => void;
  onTap?: () => void;
}

const SWIPE_THRESHOLD = 0.25;
const VELOCITY_THRESHOLD = 500;
const SPRING_CONFIG = { damping: 22, stiffness: 200, mass: 0.8 };

const QuranReader = ({
  currentPage,
  version,
  quranTheme,
  onPageChange,
  onTap,
}: QuranReaderProps) => {
  const { width, height } = useWindowDimensions();
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const isHorizontal = useSharedValue<boolean | null>(null);

  const changePage = useCallback(
    (direction: number) => {
      const newPage = currentPage + direction;
      if (newPage >= 1 && newPage <= TOTAL_PAGES) {
        onPageChange(newPage);
        // Reset after state update is queued — React will batch this
        requestAnimationFrame(() => {
          translateX.value = 0;
          translateY.value = 0;
        });
      }
    },
    [currentPage, onPageChange, translateX, translateY]
  );

  const tapGesture = Gesture.Tap().onEnd(() => {
    "worklet";
    if (onTap) {
      scheduleOnRN(onTap);
    }
  });

  const hasPrevPage = currentPage > 1;
  const hasNextPage = currentPage < TOTAL_PAGES;

  const panGesture = Gesture.Pan()
    .minDistance(15)
    .onUpdate((event) => {
      "worklet";
      if (isHorizontal.value === null) {
        if (Math.abs(event.translationX) > 10 || Math.abs(event.translationY) > 10) {
          isHorizontal.value = Math.abs(event.translationX) > Math.abs(event.translationY);
        }
        return;
      }

      if (isHorizontal.value) {
        const isNext = event.translationX > 0;
        const isPrev = event.translationX < 0;
        if ((isNext && !hasNextPage) || (isPrev && !hasPrevPage)) return;
        translateX.value = event.translationX;
      } else {
        const isNext = event.translationY < 0;
        const isPrev = event.translationY > 0;
        if ((isNext && !hasNextPage) || (isPrev && !hasPrevPage)) return;
        translateY.value = event.translationY;
      }
    })
    .onEnd((event) => {
      "worklet";
      const horizontal = isHorizontal.value;
      isHorizontal.value = null;

      if (horizontal) {
        const thresholdPx = width * SWIPE_THRESHOLD;
        const shouldAdvance =
          Math.abs(event.translationX) > thresholdPx ||
          Math.abs(event.velocityX) > VELOCITY_THRESHOLD;

        if (shouldAdvance && event.translationX > 0 && hasNextPage) {
          translateX.value = withTiming(width, { duration: 200 }, () => {
            scheduleOnRN(changePage, 1);
          });
        } else if (shouldAdvance && event.translationX < 0 && hasPrevPage) {
          translateX.value = withTiming(-width, { duration: 200 }, () => {
            scheduleOnRN(changePage, -1);
          });
        } else {
          translateX.value = withSpring(0, SPRING_CONFIG);
        }
      } else {
        const thresholdPx = height * SWIPE_THRESHOLD;
        const shouldAdvance =
          Math.abs(event.translationY) > thresholdPx ||
          Math.abs(event.velocityY) > VELOCITY_THRESHOLD;

        if (shouldAdvance && event.translationY < 0 && hasNextPage) {
          translateY.value = withTiming(-height, { duration: 200 }, () => {
            scheduleOnRN(changePage, 1);
          });
        } else if (shouldAdvance && event.translationY > 0 && hasPrevPage) {
          translateY.value = withTiming(height, { duration: 200 }, () => {
            scheduleOnRN(changePage, -1);
          });
        } else {
          translateY.value = withSpring(0, SPRING_CONFIG);
        }
      }
    });

  const currentStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }],
  }));

  // RTL: next page to the LEFT, prev to the RIGHT
  const nextHStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value - width }],
  }));

  const prevHStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value + width }],
  }));

  const nextVStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value + height }],
  }));

  const prevVStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value - height }],
  }));

  return (
    <GestureDetector gesture={Gesture.Exclusive(panGesture, tapGesture)}>
      <Animated.View style={styles.container}>
        {hasPrevPage && (
          <>
            <Animated.View style={[styles.page, prevHStyle]}>
              <QuranPage page={currentPage - 1} version={version} quranTheme={quranTheme} />
            </Animated.View>
            <Animated.View style={[styles.page, prevVStyle]}>
              <QuranPage page={currentPage - 1} version={version} quranTheme={quranTheme} />
            </Animated.View>
          </>
        )}

        <Animated.View style={[styles.page, currentStyle]}>
          <QuranPage page={currentPage} version={version} quranTheme={quranTheme} />
        </Animated.View>

        {hasNextPage && (
          <>
            <Animated.View style={[styles.page, nextHStyle]}>
              <QuranPage page={currentPage + 1} version={version} quranTheme={quranTheme} />
            </Animated.View>
            <Animated.View style={[styles.page, nextVStyle]}>
              <QuranPage page={currentPage + 1} version={version} quranTheme={quranTheme} />
            </Animated.View>
          </>
        )}
      </Animated.View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: "hidden",
  },
  page: {
    ...StyleSheet.absoluteFillObject,
  },
});

export default QuranReader;
