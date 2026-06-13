import { useCallback, useEffect, useMemo } from "react";
import { useWindowDimensions, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { MushafVersion, QuranTheme, ReaderViewMode } from "@/enums/quran";
import {
  TOTAL_PAGES,
  FONT_SIZE_MIN,
  FONT_SIZE_MAX,
  QURAN_THEME_COLORS,
  IMAGE_SOURCE_WIDTH,
  IMAGE_SOURCE_LINE_HEIGHT,
  LINES_PER_PAGE,
} from "@/constants/Quran";
import { TOTAL_SPREADS, spreadOf, pagesOfSpread } from "@/utils/readerSpread";
import { useReaderLayout } from "@/hooks/useReaderLayout";
import QuranPage from "@/components/quran/QuranPage";
import TextPage from "@/components/quran/TextPage";

interface QuranReaderProps {
  currentPage: number;
  version: MushafVersion;
  quranTheme: QuranTheme;
  readerMode: ReaderViewMode;
  fontSize: number;
  onFontSizeChange: (size: number) => void;
  onPageChange: (page: number) => void;
  onTap?: () => void;
  onAyahLongPress?: (surah: number, ayah: number) => void;
  // The selected ayah (drives the highlight; cleared when its action sheet closes).
  selectedAyah?: { surah: number; ayah: number } | null;
}

const SWIPE_THRESHOLD = 0.25;
const VELOCITY_THRESHOLD = 500;
const SPRING_CONFIG = { damping: 22, stiffness: 200, mass: 0.8 };
const PAGE_WINDOW = 2;
// Breathing room for the two-page spread: outer margins + a center gutter so
// pages don't butt against the seam/edges (tighter editions like V2 need it).
const SPREAD_OUTER_PAD = 24;
const SPREAD_GUTTER = 24;
const SPREAD_TOP_PAD = 16;
// Each line strip carries ~19% transparent padding above and below the glyphs, so
// the ink fills only ~76% of its height. Packing lines to that ink band (the line
// image clips the padding for us) gives tight, authentic spacing instead of a page
// ~30% too tall with a visible gap between every line. Lower = tighter; raise toward
// 1.0 if any glyph tops/bottoms ever clip.
const LINE_INK_RATIO = 0.78;
// A page's height:width ratio: 15 ink-packed lines over the source width.
// Large-device pages are scaled to preserve this — never stretched to the screen.
const PAGE_ASPECT =
  (IMAGE_SOURCE_LINE_HEIGHT * LINES_PER_PAGE * LINE_INK_RATIO) / IMAGE_SOURCE_WIDTH;
// Header (surah/juz) + page-number height inside a page, added to the aspect-fit
// box so the line area keeps the true ratio (tune if lines look slightly off).
const LARGE_PAGE_CHROME = 80;

// The largest undistorted page that fits a slot: width is capped by the slot AND
// by the available height (height / aspect); the box height follows the width so
// the ratio is preserved. Centre the result in the slot.
const fitPageBox = (slotWidth: number, availHeight: number) => {
  const w = Math.min(slotWidth, Math.floor((availHeight - LARGE_PAGE_CHROME) / PAGE_ASPECT));
  return { w, h: Math.round(w * PAGE_ASPECT + LARGE_PAGE_CHROME) };
};

const QuranReader = ({
  currentPage,
  version,
  quranTheme,
  readerMode,
  fontSize,
  onFontSizeChange,
  onPageChange,
  onTap,
  onAyahLongPress,
  selectedAyah,
}: QuranReaderProps) => {
  const { width, height } = useWindowDimensions();
  const layout = useReaderLayout();
  // Only the image mushaf spreads. Text reflows, so a spread would be two
  // independently-scrolling columns of unequal length — a single capped column
  // reads better.
  const isSpread = layout.mode === "spread" && readerMode !== ReaderViewMode.TEXT;
  // Large device showing one image page (portrait, or landscape with the spread
  // off): aspect-fit it like the spread halves so it isn't stretched.
  const isLargeSingle =
    layout.mode === "single" && layout.isLarge && readerMode !== ReaderViewMode.TEXT;
  const totalUnits = isSpread ? TOTAL_SPREADS : TOTAL_PAGES;
  const currentUnit = isSpread ? spreadOf(currentPage) : currentPage;

  const insets = useSafeAreaInsets();
  // Vertical space a page can occupy on a large device (used by the aspect fit).
  const availPageHeight = height - SPREAD_TOP_PAD - insets.bottom;
  // Swipes starting inside this bottom strip belong to the system home-indicator
  // gesture (swipe up to close/background the app); a vertical drag there must
  // not also turn a page. Horizontal turns from the same strip stay allowed.
  const bottomDeadZone = insets.bottom + 24;
  // Single shared value for the page-turn drag offset (normalized: 0 = rest, 1 = one unit forward)
  const dragOffset = useSharedValue(0);
  const isHorizontal = useSharedValue<boolean | null>(null);
  // True when the active gesture began in the bottom home-indicator strip.
  const startedInBottomEdge = useSharedValue(false);
  const pinchBaseFontSize = useSharedValue(fontSize);
  // The committed unit index, held on the UI thread so a swipe commit can advance it
  // and reset dragOffset in the same frame — slot positions read this, not the
  // React `currentUnit`, which lags by a frame and would otherwise flash the
  // wrong unit on each turn.
  const unitIndex = useSharedValue(currentUnit);

  useEffect(() => {
    pinchBaseFontSize.value = fontSize;
  }, [fontSize, pinchBaseFontSize]);

  // Mirror external unit changes (e.g. the page slider) onto the UI-thread index.
  useEffect(() => {
    unitIndex.value = currentUnit;
  }, [currentUnit, unitIndex]);

  const unitWindow = useMemo(() => {
    const units: number[] = [];
    for (
      let u = Math.max(1, currentUnit - PAGE_WINDOW);
      u <= Math.min(totalUnits, currentUnit + PAGE_WINDOW);
      u++
    ) {
      units.push(u);
    }
    return units;
  }, [currentUnit, totalUnits]);

  // Map a committed unit back to a page number for the store.
  // In spread mode, report the right/earlier page of the spread.
  const commitUnit = useCallback(
    (unit: number) => onPageChange(isSpread ? pagesOfSpread(unit)[0] : unit),
    [isSpread, onPageChange]
  );

  const tapGesture = Gesture.Tap().onEnd(() => {
    "worklet";
    if (onTap) {
      scheduleOnRN(onTap);
    }
  });

  const panGestureBase = Gesture.Pan().minDistance(15).cancelsTouchesInView(false);

  // In text mode, only activate on horizontal swipes so ScrollView handles vertical
  if (readerMode === ReaderViewMode.TEXT) {
    panGestureBase.activeOffsetX([-20, 20]).failOffsetY([-15, 15]);
  }

  const panGesture = panGestureBase
    .onBegin((event) => {
      "worklet";
      startedInBottomEdge.value = event.absoluteY > height - bottomDeadZone;
    })
    .onUpdate((event) => {
      "worklet";
      if (isHorizontal.value === null) {
        if (Math.abs(event.translationX) > 10 || Math.abs(event.translationY) > 10) {
          isHorizontal.value = Math.abs(event.translationX) > Math.abs(event.translationY);
        }
        return;
      }

      // A vertical drag from the bottom edge is the system close gesture, not a
      // page turn; let it pass through without moving the page.
      if (!isHorizontal.value && startedInBottomEdge.value) {
        return;
      }

      if (!isHorizontal.value && readerMode === ReaderViewMode.TEXT) {
        return;
      }

      // Normalize drag to a unit fraction
      // RTL: positive translationX = next unit (direction +1)
      // Vertical: negative translationY = next unit (direction +1)
      let normalized: number;
      if (isHorizontal.value) {
        normalized = event.translationX / width;
      } else {
        normalized = -event.translationY / height;
      }

      // Clamp at boundaries
      if (normalized > 0 && unitIndex.value >= totalUnits) return;
      if (normalized < 0 && unitIndex.value <= 1) return;

      dragOffset.value = normalized;
    })
    .onEnd((event) => {
      "worklet";
      const horizontal = isHorizontal.value;
      isHorizontal.value = null;

      // Vertical drag from the bottom edge never moved the page (see onUpdate);
      // nothing to settle.
      if (!horizontal && startedInBottomEdge.value) {
        return;
      }

      if (!horizontal && readerMode === ReaderViewMode.TEXT) {
        return;
      }

      const dimension = horizontal ? width : height;
      const translation = horizontal ? event.translationX : -event.translationY;
      const velocity = horizontal ? event.velocityX : -event.velocityY;

      const thresholdPx = dimension * SWIPE_THRESHOLD;
      const shouldAdvance =
        Math.abs(translation) > thresholdPx || Math.abs(velocity) > VELOCITY_THRESHOLD;

      // Settle time scales with fling speed — a fast flick resolves quicker than
      // a lazy drag — and eases out so the page decelerates into place.
      const speed = Math.abs(velocity);
      const remainingFraction = 1 - Math.abs(dragOffset.value);
      const turnDuration =
        speed > 50
          ? Math.max(140, Math.min(280, ((remainingFraction * dimension) / speed) * 1000))
          : 240;
      const turnTiming = { duration: turnDuration, easing: Easing.out(Easing.cubic) };

      if (shouldAdvance && translation > 0 && unitIndex.value < totalUnits) {
        dragOffset.value = withTiming(1, turnTiming, (finished) => {
          if (!finished) return;
          // Advance the index and zero the drag in the same UI frame so the turn
          // is seamless; React syncs afterward for windowing + persistence.
          unitIndex.value = unitIndex.value + 1;
          dragOffset.value = 0;
          scheduleOnRN(commitUnit, unitIndex.value);
        });
      } else if (shouldAdvance && translation < 0 && unitIndex.value > 1) {
        dragOffset.value = withTiming(-1, turnTiming, (finished) => {
          if (!finished) return;
          unitIndex.value = unitIndex.value - 1;
          dragOffset.value = 0;
          scheduleOnRN(commitUnit, unitIndex.value);
        });
      } else {
        dragOffset.value = withSpring(0, SPRING_CONFIG);
      }
    });

  const pinchGesture = Gesture.Pinch().onEnd((event) => {
    "worklet";
    const newSize = Math.round(pinchBaseFontSize.value * event.scale);
    const clamped = Math.max(FONT_SIZE_MIN, Math.min(FONT_SIZE_MAX, newSize));
    scheduleOnRN(onFontSizeChange, clamped);
  });

  const composedGesture =
    readerMode === ReaderViewMode.TEXT
      ? Gesture.Simultaneous(pinchGesture, Gesture.Exclusive(panGesture, tapGesture))
      : Gesture.Exclusive(panGesture, tapGesture);

  return (
    <GestureDetector gesture={composedGesture}>
      <Animated.View style={styles.container}>
        {unitWindow.map((unit) => (
          <PageSlot
            key={unit}
            unit={unit}
            isSpread={isSpread}
            isLargeSingle={isLargeSingle}
            availPageHeight={availPageHeight}
            unitIndex={unitIndex}
            version={version}
            quranTheme={quranTheme}
            readerMode={readerMode}
            fontSize={fontSize}
            dragOffset={dragOffset}
            width={width}
            onAyahLongPress={onAyahLongPress}
            selectedAyah={selectedAyah}
          />
        ))}
      </Animated.View>
    </GestureDetector>
  );
};

interface PageSlotProps {
  unit: number;
  isSpread: boolean;
  isLargeSingle: boolean;
  availPageHeight: number;
  unitIndex: SharedValue<number>;
  version: MushafVersion;
  quranTheme: QuranTheme;
  readerMode: ReaderViewMode;
  fontSize: number;
  dragOffset: SharedValue<number>;
  width: number;
  onAyahLongPress?: (surah: number, ayah: number) => void;
  selectedAyah?: { surah: number; ayah: number } | null;
}

const PageSlot = ({
  unit,
  isSpread,
  isLargeSingle,
  availPageHeight,
  unitIndex,
  version,
  quranTheme,
  readerMode,
  fontSize,
  dragOffset,
  width,
  onAyahLongPress,
  selectedAyah,
}: PageSlotProps) => {
  const animatedStyle = useAnimatedStyle(() => {
    // unitOffset: 0 = current, -1 = next (left in RTL), +1 = prev (right).
    // dragOffset: 0 = rest, +1 = swiped to next, -1 = swiped to prev.
    // Position is driven entirely by the UI-thread index + drag, so a unit turn
    // moves both in one frame with no intermediate mismatch.
    const unitOffset = -(unit - unitIndex.value);
    const translateX = (unitOffset + dragOffset.value) * width;
    return { transform: [{ translateX }] };
  });

  if (!isSpread) {
    // Text mode (any device) and phone image mode fill the full width.
    if (readerMode === ReaderViewMode.TEXT || !isLargeSingle) {
      return (
        <Animated.View style={[styles.page, animatedStyle]}>
          {readerMode === ReaderViewMode.TEXT ? (
            <TextPage
              page={unit}
              quranTheme={quranTheme}
              width={width}
              fontSize={fontSize}
              onAyahLongPress={onAyahLongPress}
              selectedAyah={selectedAyah}
            />
          ) : (
            <QuranPage
              page={unit}
              version={version}
              quranTheme={quranTheme}
              width={width}
              onAyahLongPress={onAyahLongPress}
              selectedAyah={selectedAyah}
            />
          )}
        </Animated.View>
      );
    }
    // Large device, single image page: aspect-fit + centred (never stretched).
    const single = fitPageBox(width, availPageHeight);
    return (
      <Animated.View style={[styles.page, animatedStyle]}>
        <View
          style={[
            styles.centerBox,
            { backgroundColor: QURAN_THEME_COLORS[quranTheme].background },
          ]}>
          <View style={{ width: single.w, height: single.h }}>
            <QuranPage
              page={unit}
              version={version}
              quranTheme={quranTheme}
              width={single.w}
              onAyahLongPress={onAyahLongPress}
              selectedAyah={selectedAyah}
            />
          </View>
        </View>
      </Animated.View>
    );
  }

  // Spread (image only — text never spreads). pagesOfSpread === [right, left].
  // Each half aspect-fits its column so the pages keep their true shape.
  const pages = pagesOfSpread(unit);
  const halfWidth = (width - SPREAD_OUTER_PAD * 2 - SPREAD_GUTTER) / 2;
  const box = fitPageBox(halfWidth, availPageHeight);
  return (
    <Animated.View style={[styles.page, animatedStyle]}>
      {/* RTL: earlier page should sit on the RIGHT. flexDirection "row" places
          pages[0] first; on device, if the order is reversed, flip this single
          line (reverse `pages` OR use "row-reverse"). */}
      <View
        style={[styles.spreadRow, { backgroundColor: QURAN_THEME_COLORS[quranTheme].background }]}>
        {pages.map((p) => (
          <View key={p} style={styles.centerBox}>
            <View style={{ width: box.w, height: box.h }}>
              <QuranPage
                page={p}
                width={box.w}
                version={version}
                quranTheme={quranTheme}
                onAyahLongPress={onAyahLongPress}
                selectedAyah={selectedAyah}
              />
            </View>
          </View>
        ))}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: "hidden",
  },
  page: {
    ...StyleSheet.absoluteFill,
  },
  centerBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  spreadRow: {
    flex: 1,
    flexDirection: "row",
    paddingHorizontal: SPREAD_OUTER_PAD,
    paddingTop: SPREAD_TOP_PAD,
    gap: SPREAD_GUTTER,
  },
});

export default QuranReader;
