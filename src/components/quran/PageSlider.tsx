import { useCallback, useEffect, useRef, useState } from "react";
import { View, StyleSheet, LayoutChangeEvent } from "react-native";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from "react-native-reanimated";

import { QuranTheme } from "@/enums/quran";
import { TOTAL_PAGES, QURAN_THEME_COLORS } from "@/constants/Quran";
import { useTranslation } from "react-i18next";

import { localizedSurahName, metadataFontFamily } from "@/utils/surahName";
import { formatNumberToLocale } from "@/utils/number";
import { QuranContentDB } from "@/services/quran-content-db";
import { useHaptic } from "@/hooks/useHaptic";
import { Text } from "@/components/ui/text";

interface PageSliderProps {
  currentPage: number;
  quranTheme: QuranTheme;
  onPageChange: (page: number) => void;
}

// Thin track with a small circular handle, flanked by the current page and the
// total. The track grows with `flex`, so its width is measured (not derived from
// the screen) — robust to the labels and any container padding.
const TOUCH_HEIGHT = 40;
const LINE_HEIGHT = 4;
const HANDLE = 16;
const HANDLE_DRAG = 22;
const LABEL_WIDTH = 34;
const TOOLTIP_WIDTH = 168;
// Decorative ink-line widths (%) for the mini mushaf-page thumbnail in the card.
const THUMB_LINES = [82, 68, 78, 60, 74];

const PageSlider = ({ currentPage, quranTheme, onPageChange }: PageSliderProps) => {
  const { t } = useTranslation();
  const themeColors = QURAN_THEME_COLORS[quranTheme];
  const isDark = quranTheme === QuranTheme.DARK;
  const haptic = useHaptic("light");

  const [trackWidth, setTrackWidth] = useState(0);
  const slidableWidth = Math.max(0, trackWidth - HANDLE);

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

  // RTL track: page 1 sits at the right end, page 604 at the left.
  const pageToX = (page: number): number => {
    const progress = (page - 1) / (TOTAL_PAGES - 1);
    return slidableWidth * (1 - progress);
  };

  const xToPage = (x: number): number => {
    "worklet";
    if (slidableWidth <= 0) return 1;
    const progress = 1 - x / slidableWidth;
    return Math.max(1, Math.min(TOTAL_PAGES, Math.round(progress * (TOTAL_PAGES - 1) + 1)));
  };

  const thumbX = useSharedValue(pageToX(currentPage));
  const isDragging = useSharedValue(false);
  const [draggingPage, setDraggingPage] = useState(currentPage);
  const [showTooltip, setShowTooltip] = useState(false);
  // Last page a scrub haptic fired for, so each page the thumb crosses ticks once.
  const lastTickPageRef = useRef(currentPage);

  // Sync thumb when currentPage changes externally (swiping) or the track is
  // (re)measured.
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
    const x = Math.max(0, Math.min(slidableWidth, event.x - HANDLE / 2));
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
      const newX = Math.max(0, Math.min(slidableWidth, event.x - HANDLE / 2));
      thumbX.set(newX);
      const page = xToPage(newX);
      runOnJS(updateDraggingPage)(page);
      runOnJS(showTooltipFn)();
    })
    // eslint-disable-next-line react-hooks/refs
    .onUpdate((event) => {
      "worklet";
      const newX = Math.max(0, Math.min(slidableWidth, event.x - HANDLE / 2));
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

  const handleStyle = useAnimatedStyle(() => {
    const size = isDragging.get() ? HANDLE_DRAG : HANDLE;
    return {
      width: size,
      height: size,
      borderRadius: size / 2,
      top: (TOUCH_HEIGHT - size) / 2,
      // Keep the handle centred on the page position as it grows on drag.
      transform: [{ translateX: thumbX.get() + HANDLE / 2 - size / 2 }],
    };
  });

  const tooltipStyle = useAnimatedStyle(() => {
    // Centre the card on the handle, but clamp it inside the track so it never
    // spills past the screen edge near page 1 (right) or 604 (left).
    const centered = thumbX.get() + HANDLE / 2 - TOOLTIP_WIDTH / 2;
    const max = Math.max(0, trackWidth - TOOLTIP_WIDTH);
    return { transform: [{ translateX: Math.min(Math.max(centered, 0), max) }] };
  });

  // Filled portion runs from the right end (page 1) to the handle.
  const trackActiveStyle = useAnimatedStyle(() => ({
    width: Math.max(0, trackWidth - thumbX.get() - HANDLE / 2),
  }));

  const onTrackLayout = (e: LayoutChangeEvent) => setTrackWidth(e.nativeEvent.layout.width);

  const surahNumber = pageToSurah.get(draggingPage) ?? 1;
  const surahName = localizedSurahName(surahNumber);

  const trackColor = isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.10)";
  const accent = themeColors.frameColor;

  return (
    <View style={styles.row}>
      <Text style={[styles.endLabel, { color: themeColors.pageNumberColor }]}>
        {formatNumberToLocale(String(TOTAL_PAGES))}
      </Text>

      <GestureDetector gesture={composedGesture}>
        <View style={styles.touch} onLayout={onTrackLayout}>
          {showTooltip && (
            <Animated.View
              style={[
                styles.tooltip,
                tooltipStyle,
                {
                  backgroundColor: isDark ? "#2A2A2A" : "#F5F0E8",
                  borderColor: themeColors.frameColor,
                },
              ]}>
              {/* Mini mushaf page — decorative ink lines on paper. */}
              <View style={[styles.thumb, { backgroundColor: themeColors.innerBackground }]}>
                {THUMB_LINES.map((w, i) => (
                  <View
                    key={i}
                    style={{
                      height: 2,
                      borderRadius: 1,
                      width: `${w}%`,
                      alignSelf: "flex-end",
                      backgroundColor: themeColors.headerColor,
                      opacity: 0.45,
                    }}
                  />
                ))}
              </View>
              <View style={styles.tooltipText}>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.tooltipSurah,
                    { color: themeColors.headerColor, fontFamily: metadataFontFamily() },
                  ]}>
                  {surahName}
                </Text>
                <Text style={[styles.tooltipPage, { color: themeColors.pageNumberColor }]}>
                  {`${t("quran.goto.page")} ${formatNumberToLocale(String(draggingPage))}`}
                </Text>
              </View>
            </Animated.View>
          )}
          <View style={[styles.line, { backgroundColor: trackColor }]}>
            <Animated.View
              style={[styles.lineActive, trackActiveStyle, { backgroundColor: accent }]}
            />
          </View>
          <Animated.View style={[styles.handle, handleStyle, { backgroundColor: accent }]} />
        </View>
      </GestureDetector>

      <Text style={[styles.endLabel, { color: themeColors.pageNumberColor }]}>
        {formatNumberToLocale(String(draggingPage))}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    direction: "ltr",
    gap: 12,
  },
  endLabel: {
    width: LABEL_WIDTH,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  touch: {
    flex: 1,
    height: TOUCH_HEIGHT,
    justifyContent: "center",
  },
  line: {
    height: LINE_HEIGHT,
    borderRadius: LINE_HEIGHT / 2,
    overflow: "hidden",
  },
  lineActive: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
  },
  handle: {
    position: "absolute",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.32,
    shadowRadius: 5,
    elevation: 3,
  },
  tooltip: {
    position: "absolute",
    bottom: TOUCH_HEIGHT - 2,
    width: TOOLTIP_WIDTH,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  thumb: {
    width: 28,
    height: 36,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 5,
    justifyContent: "center",
    gap: 3,
    overflow: "hidden",
  },
  tooltipText: {
    flex: 1,
  },
  tooltipSurah: {
    fontSize: 15,
    fontWeight: "700",
    textAlign: "right",
    writingDirection: "rtl",
  },
  tooltipPage: {
    fontSize: 12,
    textAlign: "right",
    writingDirection: "rtl",
    marginTop: 2,
  },
});

export default PageSlider;
