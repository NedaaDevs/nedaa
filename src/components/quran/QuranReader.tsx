import { useCallback, useMemo } from "react";
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
const PAGE_WINDOW = 2;

const QuranReader = ({
  currentPage,
  version,
  quranTheme,
  onPageChange,
  onTap,
}: QuranReaderProps) => {
  const { width, height } = useWindowDimensions();
  // Single shared value for page offset (normalized: 0 = current, 1 = one page forward)
  const dragOffset = useSharedValue(0);
  const isHorizontal = useSharedValue<boolean | null>(null);

  const pageWindow = useMemo(() => {
    const pages: number[] = [];
    for (
      let p = Math.max(1, currentPage - PAGE_WINDOW);
      p <= Math.min(TOTAL_PAGES, currentPage + PAGE_WINDOW);
      p++
    ) {
      pages.push(p);
    }
    return pages;
  }, [currentPage]);

  const changePage = useCallback(
    (direction: number) => {
      const newPage = currentPage + direction;
      if (newPage >= 1 && newPage <= TOTAL_PAGES) {
        onPageChange(newPage);
        requestAnimationFrame(() => {
          dragOffset.value = 0;
        });
      }
    },
    [currentPage, onPageChange, dragOffset]
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

      // Normalize drag to a page fraction
      // RTL: positive translationX = next page (direction +1)
      // Vertical: negative translationY = next page (direction +1)
      let normalized: number;
      if (isHorizontal.value) {
        normalized = event.translationX / width;
      } else {
        normalized = -event.translationY / height;
      }

      // Clamp at boundaries
      if (normalized > 0 && !hasNextPage) return;
      if (normalized < 0 && !hasPrevPage) return;

      dragOffset.value = normalized;
    })
    .onEnd((event) => {
      "worklet";
      const horizontal = isHorizontal.value;
      isHorizontal.value = null;

      const dimension = horizontal ? width : height;
      const translation = horizontal ? event.translationX : -event.translationY;
      const velocity = horizontal ? event.velocityX : -event.velocityY;

      const thresholdPx = dimension * SWIPE_THRESHOLD;
      const shouldAdvance =
        Math.abs(translation) > thresholdPx || Math.abs(velocity) > VELOCITY_THRESHOLD;

      if (shouldAdvance && translation > 0 && hasNextPage) {
        dragOffset.value = withTiming(1, { duration: 200 }, () => {
          scheduleOnRN(changePage, 1);
        });
      } else if (shouldAdvance && translation < 0 && hasPrevPage) {
        dragOffset.value = withTiming(-1, { duration: 200 }, () => {
          scheduleOnRN(changePage, -1);
        });
      } else {
        dragOffset.value = withSpring(0, SPRING_CONFIG);
      }
    });

  return (
    <GestureDetector gesture={Gesture.Exclusive(panGesture, tapGesture)}>
      <Animated.View style={styles.container}>
        {pageWindow.map((page) => (
          <PageSlot
            key={page}
            page={page}
            currentPage={currentPage}
            version={version}
            quranTheme={quranTheme}
            dragOffset={dragOffset}
            width={width}
          />
        ))}
      </Animated.View>
    </GestureDetector>
  );
};

interface PageSlotProps {
  page: number;
  currentPage: number;
  version: MushafVersion;
  quranTheme: QuranTheme;
  dragOffset: Animated.SharedValue<number>;
  width: number;
}

const PageSlot = ({ page, currentPage, version, quranTheme, dragOffset, width }: PageSlotProps) => {
  // RTL layout: next page (higher number) is to the LEFT
  // pageOffset: 0 = current, -1 = next (left), +1 = prev (right)
  const pageOffset = -(page - currentPage);

  const animatedStyle = useAnimatedStyle(() => {
    // dragOffset: 0 = rest, +1 = swiped to next, -1 = swiped to prev
    // Translate combines static page position + drag gesture
    const translateX = (pageOffset + dragOffset.value) * width;
    return { transform: [{ translateX }] };
  });

  return (
    <Animated.View style={[styles.page, animatedStyle]}>
      <QuranPage page={page} version={version} quranTheme={quranTheme} />
    </Animated.View>
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
