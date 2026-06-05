import { useCallback, useEffect, useRef, useState } from "react";
import { View, StyleSheet, useWindowDimensions } from "react-native";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from "react-native-reanimated";

import { QuranTheme } from "@/enums/quran";
import { TOTAL_PAGES, QURAN_THEME_COLORS } from "@/constants/Quran";
import { localizedSurahName, metadataFontFamily } from "@/utils/surahName";
import { QuranContentDB } from "@/services/quran-content-db";
import { useHaptic } from "@/hooks/useHaptic";
import { Text } from "@/components/ui/text";

const toArabicDigits = (n: number): string =>
  String(n).replace(/\d/g, (d) => String.fromCharCode(0x0660 + +d));

interface PageSliderProps {
  currentPage: number;
  quranTheme: QuranTheme;
  onPageChange: (page: number) => void;
}

const TRACK_HEIGHT = 36;
const TRACK_RADIUS = 18;
const THUMB_WIDTH = 60;
const THUMB_HEIGHT = 30;
const THUMB_RADIUS = 15;
const HORIZONTAL_PADDING = 16;

const PageSlider = ({ currentPage, quranTheme, onPageChange }: PageSliderProps) => {
  const { width: screenWidth } = useWindowDimensions();
  const themeColors = QURAN_THEME_COLORS[quranTheme];
  const isDark = quranTheme === QuranTheme.DARK;
  const haptic = useHaptic("light");

  const trackWidth = screenWidth - HORIZONTAL_PADDING * 2;
  const slidableWidth = trackWidth - THUMB_WIDTH;

  const [pageToSurah, setPageToSurah] = useState<Map<number, number>>(new Map());

  useEffect(() => {
    const loadMapping = async () => {
      const db = await QuranContentDB.openQuranDb();
      const rows = await db.getAllAsync<{ page: number; surah_number: number }>(
        "SELECT page, MIN(surah_number) as surah_number FROM ayahs GROUP BY page ORDER BY page"
      );
      const map = new Map<number, number>();
      for (const row of rows) {
        map.set(row.page, row.surah_number);
      }
      setPageToSurah(map);
    };
    loadMapping();
  }, []);

  const pageToX = (page: number): number => {
    const progress = (page - 1) / (TOTAL_PAGES - 1);
    return slidableWidth * (1 - progress);
  };

  const xToPage = (x: number): number => {
    "worklet";
    const progress = 1 - x / slidableWidth;
    return Math.max(1, Math.min(TOTAL_PAGES, Math.round(progress * (TOTAL_PAGES - 1) + 1)));
  };

  const thumbX = useSharedValue(pageToX(currentPage));
  const isDragging = useSharedValue(false);
  const [draggingPage, setDraggingPage] = useState(currentPage);
  const [showTooltip, setShowTooltip] = useState(false);
  // Last page a scrub haptic fired for, so each page the thumb crosses ticks once.
  const lastTickPageRef = useRef(currentPage);

  // Sync thumb when currentPage changes externally (e.g. swiping pages)
  useEffect(() => {
    if (!isDragging.get()) {
      thumbX.set(withTiming(pageToX(currentPage), { duration: 150 }));
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDraggingPage(currentPage);
      lastTickPageRef.current = currentPage;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, slidableWidth]);

  const updateDraggingPage = useCallback(
    (page: number) => {
      setDraggingPage(page);
      // Tick once per page the scrub crosses (frame-rate bounded, so a fast
      // flick ticks per frame rather than per intermediate page).
      if (page !== lastTickPageRef.current) {
        lastTickPageRef.current = page;
        haptic();
      }
    },
    [haptic]
  );

  const showTooltipFn = useCallback(() => setShowTooltip(true), []);
  const hideTooltipFn = useCallback(() => setShowTooltip(false), []);

  const handlePageCommit = useCallback(
    (page: number) => {
      if (page !== currentPage) {
        haptic();
        onPageChange(page);
      }
      hideTooltipFn();
    },
    [currentPage, onPageChange, haptic, hideTooltipFn]
  );

  const tapGesture = Gesture.Tap().onEnd((event) => {
    "worklet";
    const x = Math.max(0, Math.min(slidableWidth, event.x - THUMB_WIDTH / 2));
    thumbX.set(withTiming(x, { duration: 150 }));
    const page = xToPage(x);
    runOnJS(handlePageCommit)(page);
  });

  const panGesture = Gesture.Pan()
    .minDistance(0)
    // eslint-disable-next-line react-hooks/refs
    .onStart((event) => {
      "worklet";
      isDragging.set(true);
      const newX = Math.max(0, Math.min(slidableWidth, event.x - THUMB_WIDTH / 2));
      thumbX.set(newX);
      const page = xToPage(newX);
      runOnJS(updateDraggingPage)(page);
      runOnJS(showTooltipFn)();
    })
    // eslint-disable-next-line react-hooks/refs
    .onUpdate((event) => {
      "worklet";
      const newX = Math.max(0, Math.min(slidableWidth, event.x - THUMB_WIDTH / 2));
      thumbX.set(newX);
      const page = xToPage(newX);
      runOnJS(updateDraggingPage)(page);
    })
    .onEnd(() => {
      "worklet";
      isDragging.set(false);
      const page = xToPage(thumbX.get());
      runOnJS(handlePageCommit)(page);
    });

  const longPressGesture = Gesture.LongPress()
    .minDuration(100)
    .onStart(() => {
      "worklet";
      runOnJS(showTooltipFn)();
    });

  const composedGesture = Gesture.Simultaneous(
    longPressGesture,
    Gesture.Race(panGesture, tapGesture)
  );

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: thumbX.get() }],
  }));

  const tooltipStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: thumbX.get() + THUMB_WIDTH / 2 - 70 }],
  }));

  const trackActiveStyle = useAnimatedStyle(() => ({
    width: trackWidth - thumbX.get() - THUMB_WIDTH / 2,
    right: 0,
    backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.03)",
  }));

  const surahNumber = pageToSurah.get(draggingPage) ?? 1;
  const surahName = localizedSurahName(surahNumber);

  const trackColor = isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)";

  return (
    <View style={[styles.container, { paddingHorizontal: HORIZONTAL_PADDING }]}>
      {showTooltip && (
        <Animated.View
          style={[
            styles.tooltip,
            tooltipStyle,
            {
              backgroundColor: isDark ? "#2A2A2A" : "#F5F0E8",
              borderColor: isDark ? "#444" : "#D4C5A9",
            },
          ]}>
          <Text
            style={[
              styles.tooltipSurah,
              { color: themeColors.headerColor, fontFamily: metadataFontFamily() },
            ]}>
            {surahName}
          </Text>
          <Text style={[styles.tooltipPage, { color: themeColors.pageNumberColor }]}>
            {"الصفحة " + toArabicDigits(draggingPage)}
          </Text>
        </Animated.View>
      )}

      <GestureDetector gesture={composedGesture}>
        <Animated.View
          style={[styles.track, { backgroundColor: trackColor, width: trackWidth }]}
          accessibilityRole="adjustable"
          accessibilityLabel={`Page ${draggingPage} of ${TOTAL_PAGES}`}>
          <Animated.View style={[styles.trackActive, trackActiveStyle]} />
          <Animated.View
            style={[styles.thumb, thumbStyle, { backgroundColor: themeColors.markerColor }]}
          />
        </Animated.View>
      </GestureDetector>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "relative",
    direction: "ltr",
  },
  tooltip: {
    position: "absolute",
    bottom: TRACK_HEIGHT + 12,
    width: 140,
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  tooltipSurah: {
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
    writingDirection: "rtl",
  },
  tooltipPage: {
    fontSize: 13,
    textAlign: "center",
    writingDirection: "rtl",
    marginTop: 2,
  },
  track: {
    height: TRACK_HEIGHT,
    borderRadius: TRACK_RADIUS,
    justifyContent: "center",
    overflow: "hidden",
  },
  trackActive: {
    position: "absolute",
    height: TRACK_HEIGHT,
    borderRadius: TRACK_RADIUS,
  },
  thumb: {
    position: "absolute",
    width: THUMB_WIDTH,
    height: THUMB_HEIGHT,
    borderRadius: THUMB_RADIUS,
    top: (TRACK_HEIGHT - THUMB_HEIGHT) / 2,
  },
});

export default PageSlider;
