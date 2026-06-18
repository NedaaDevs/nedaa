import { Fragment, useCallback, useEffect, useMemo, useRef } from "react";
import {
  useWindowDimensions,
  StyleSheet,
  View,
  ScrollView,
  I18nManager,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
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

import { MushafVersion, QuranThemeType, ReaderViewMode, ReaderPageFit } from "@/enums/quran";
import { TOTAL_PAGES, FONT_SIZE_MIN, FONT_SIZE_MAX, QURAN_THEME_COLORS } from "@/constants/Quran";
import {
  TOTAL_SPREADS,
  spreadOf,
  pagesOfSpread,
  ReaderLayoutMode,
  fitPageBox,
  fitWidthBox,
} from "@/utils/readerSpread";
import { useReaderLayout } from "@/hooks/useReaderLayout";
import { useQuranStore } from "@/stores/quran";
import QuranPage from "@/components/quran/QuranPage";
import TextPage from "@/components/quran/TextPage";

interface QuranReaderProps {
  currentPage: number;
  version: MushafVersion;
  quranTheme: QuranThemeType;
  readerMode: ReaderViewMode;
  fontSize: number;
  onFontSizeChange: (size: number) => void;
  onPageChange: (page: number) => void;
  onTap?: () => void;
  onAyahLongPress?: (surah: number, ayah: number) => void;
  onSurahLongPress?: (surah: number) => void;
  onWaqfPress?: (signId: string) => void;
  // The selected ayah (drives the highlight; cleared when its action sheet closes).
  selectedAyah?: { surah: number; ayah: number } | null;
}

const SWIPE_THRESHOLD = 0.25;
const VELOCITY_THRESHOLD = 500;
const SPRING_CONFIG = { damping: 22, stiffness: 200, mass: 0.8 };
const PAGE_WINDOW = 2;
// How long a search-jump highlight stays on the target ayah before clearing.
const FLASH_CLEAR_MS = 2000;
// Gap between the two spread pages at the spine, and top breathing room.
const SPREAD_GUTTER = 10;
const SPREAD_TOP_PAD = 16;

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
  onSurahLongPress,
  onWaqfPress,
  selectedAyah,
}: QuranReaderProps) => {
  const { width, height } = useWindowDimensions();
  const layout = useReaderLayout();
  // Only the image mushaf spreads. Text reflows, so a spread would be two
  // independently-scrolling columns of unequal length — a single capped column
  // reads better.
  const isSpread = layout.mode === ReaderLayoutMode.SPREAD && readerMode !== ReaderViewMode.TEXT;
  // Large device showing one image page (portrait, or landscape with the spread
  // off).
  const isLargeSingle =
    layout.mode === ReaderLayoutMode.SINGLE && layout.isLarge && readerMode !== ReaderViewMode.TEXT;
  // Large + landscape single: fit the page to the width and scroll it vertically
  // (the whole page won't fit the short height). Portrait single still aspect-fits.
  const isLandscapeScroll = isLargeSingle && layout.isLandscape;
  // Modes where a vertical drag scrolls the page instead of turning it: text mode
  // (reflowed column) and the landscape single page (taller than the screen).
  const verticalScrolls = readerMode === ReaderViewMode.TEXT || isLandscapeScroll;
  // Frame each page like a physical sheet (large devices only — phones fill the
  // width, where a border would just hug the screen edge).
  const framed = useQuranStore((s) => s.pageFit) === ReaderPageFit.PAGE;
  // Per-page vertical scroll offset, remembered for the session so flipping back to
  // a landscape page returns to where you left off. Transient (resets on restart).
  const scrollOffsets = useRef<Map<number, number>>(new Map());
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

  // A search jump sets `flashAyah`; the page pulse-highlights it, then we clear
  // the flag so it doesn't re-fire on later renders.
  const flashAyah = useQuranStore((s) => s.flashAyah);
  const clearFlashAyah = useQuranStore((s) => s.clearFlashAyah);
  useEffect(() => {
    if (!flashAyah) return;
    const id = setTimeout(clearFlashAyah, FLASH_CLEAR_MS);
    return () => clearTimeout(id);
  }, [flashAyah, clearFlashAyah]);

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

  // When a page scrolls vertically, only activate the page-turn pan on horizontal
  // swipes so the inner ScrollView keeps the vertical drag.
  if (verticalScrolls) {
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

      if (!isHorizontal.value && verticalScrolls) {
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

      if (!horizontal && verticalScrolls) {
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
            isLandscapeScroll={isLandscapeScroll}
            framed={framed}
            availPageHeight={availPageHeight}
            scrollPadTop={insets.top + 8}
            scrollPadBottom={insets.bottom + 8}
            scrollOffsets={scrollOffsets}
            unitIndex={unitIndex}
            version={version}
            quranTheme={quranTheme}
            readerMode={readerMode}
            fontSize={fontSize}
            dragOffset={dragOffset}
            width={width}
            onAyahLongPress={onAyahLongPress}
            onSurahLongPress={onSurahLongPress}
            onWaqfPress={onWaqfPress}
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
  isLandscapeScroll: boolean;
  framed: boolean;
  availPageHeight: number;
  scrollPadTop: number;
  scrollPadBottom: number;
  scrollOffsets: React.RefObject<Map<number, number>>;
  unitIndex: SharedValue<number>;
  version: MushafVersion;
  quranTheme: QuranThemeType;
  readerMode: ReaderViewMode;
  fontSize: number;
  dragOffset: SharedValue<number>;
  width: number;
  onAyahLongPress?: (surah: number, ayah: number) => void;
  onSurahLongPress?: (surah: number) => void;
  onWaqfPress?: (signId: string) => void;
  selectedAyah?: { surah: number; ayah: number } | null;
}

const PageSlot = ({
  unit,
  isSpread,
  isLargeSingle,
  isLandscapeScroll,
  framed,
  availPageHeight,
  scrollPadTop,
  scrollPadBottom,
  scrollOffsets,
  unitIndex,
  version,
  quranTheme,
  readerMode,
  fontSize,
  dragOffset,
  width,
  onAyahLongPress,
  onSurahLongPress,
  onWaqfPress,
  selectedAyah,
}: PageSlotProps) => {
  // Vertical-scroll page (landscape single): restore the remembered offset once the
  // content is measured, and save it as the reader scrolls. Plain functions (not
  // useCallback) — they read refs, which the React Compiler memoizes for us.
  const scrollRef = useRef<ScrollView>(null);
  const restoredScroll = useRef(false);
  const onScrollContentSize = () => {
    if (restoredScroll.current) return;
    restoredScroll.current = true;
    const y = scrollOffsets.current?.get(unit) ?? 0;
    if (y > 0) scrollRef.current?.scrollTo({ y, animated: false });
  };
  const onPageScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollOffsets.current?.set(unit, e.nativeEvent.contentOffset.y);
  };

  const animatedStyle = useAnimatedStyle(() => {
    // unitOffset: 0 = current, -1 = next (left in RTL), +1 = prev (right).
    // dragOffset: 0 = rest, +1 = swiped to next, -1 = swiped to prev.
    // Position is driven entirely by the UI-thread index + drag, so a unit turn
    // moves both in one frame with no intermediate mismatch.
    const unitOffset = -(unit - unitIndex.value);
    const translateX = (unitOffset + dragOffset.value) * width;
    return { transform: [{ translateX }] };
  });

  // When the "Page" fit is on, a page box is framed like a physical sheet (border +
  // rounded corners). Only the large-device paths use this — phones fill the width.
  const frameColor = QURAN_THEME_COLORS[quranTheme].frameColor;
  const pageBoxStyle = (w: number, h: number) => [
    { width: w, height: h },
    framed ? [styles.framedPage, { borderColor: frameColor }] : null,
  ];

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
              onSurahLongPress={onSurahLongPress}
              onWaqfPress={onWaqfPress}
              selectedAyah={selectedAyah}
            />
          ) : (
            <QuranPage
              page={unit}
              version={version}
              quranTheme={quranTheme}
              width={width}
              onAyahLongPress={onAyahLongPress}
              onSurahLongPress={onSurahLongPress}
              selectedAyah={selectedAyah}
            />
          )}
        </Animated.View>
      );
    }
    // Large landscape single: fit the page to the (capped) width and scroll it
    // vertically — the whole page is too tall for the short landscape height.
    if (isLandscapeScroll) {
      const box = fitWidthBox(width);
      return (
        <Animated.View style={[styles.page, animatedStyle]}>
          <ScrollView
            ref={scrollRef}
            style={{ flex: 1, backgroundColor: QURAN_THEME_COLORS[quranTheme].background }}
            contentContainerStyle={{
              flexGrow: 1,
              alignItems: "center",
              justifyContent: "center",
              paddingTop: scrollPadTop,
              paddingBottom: scrollPadBottom,
            }}
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={16}
            onScroll={onPageScroll}
            onContentSizeChange={onScrollContentSize}>
            <View style={pageBoxStyle(box.w, box.h)}>
              <QuranPage
                page={unit}
                version={version}
                quranTheme={quranTheme}
                width={box.w}
                onAyahLongPress={onAyahLongPress}
                onSurahLongPress={onSurahLongPress}
                selectedAyah={selectedAyah}
              />
            </View>
          </ScrollView>
        </Animated.View>
      );
    }
    // Large portrait single: aspect-fit + centred (whole page, never stretched).
    const single = fitPageBox(width, availPageHeight);
    return (
      <Animated.View style={[styles.page, animatedStyle]}>
        <View
          style={[
            styles.centerBox,
            { backgroundColor: QURAN_THEME_COLORS[quranTheme].background },
          ]}>
          <View style={pageBoxStyle(single.w, single.h)}>
            <QuranPage
              page={unit}
              version={version}
              quranTheme={quranTheme}
              width={single.w}
              onAyahLongPress={onAyahLongPress}
              onSurahLongPress={onSurahLongPress}
              selectedAyah={selectedAyah}
            />
          </View>
        </View>
      </Animated.View>
    );
  }

  // Open-book spread: the two undistorted pages sit adjacent at the spine, centred
  // as a pair, so the inherent fit-to-height margin falls on the outer edges as
  // balanced book margins instead of scattered gaps. pagesOfSpread === [right,
  // left]; RTL flips the row on device.
  const pages = pagesOfSpread(unit);
  const halfWidth = (width - SPREAD_GUTTER) / 2;
  const box = fitPageBox(halfWidth, availPageHeight);
  return (
    <Animated.View style={[styles.page, animatedStyle]}>
      <View
        style={[styles.spreadRow, { backgroundColor: QURAN_THEME_COLORS[quranTheme].background }]}>
        {pages.map((p, i) => (
          <Fragment key={p}>
            {i > 0 && (
              // Fold seam between the two pages — a faint vertical rule, like the
              // spine of an open mushaf.
              <View
                style={[
                  styles.spine,
                  { height: box.h, backgroundColor: QURAN_THEME_COLORS[quranTheme].frameColor },
                ]}
              />
            )}
            <View style={pageBoxStyle(box.w, box.h)}>
              <QuranPage
                page={p}
                width={box.w}
                version={version}
                quranTheme={quranTheme}
                // pagesOfSpread is [earlier, later]; RN flips flexDirection:row
                // under RTL, so the earlier page sits on the visual right only
                // when the layout is RTL. Match the header's outer edge to that.
                side={(i === 0) === I18nManager.isRTL ? "right" : "left"}
                onAyahLongPress={onAyahLongPress}
                onSurahLongPress={onSurahLongPress}
                selectedAyah={selectedAyah}
              />
            </View>
          </Fragment>
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
    alignItems: "center",
    justifyContent: "center",
    paddingTop: SPREAD_TOP_PAD,
    gap: SPREAD_GUTTER,
  },
  spine: {
    width: 1.5,
    alignSelf: "center",
    borderRadius: 1,
    opacity: 0.3,
  },
  // Framed "page" look: a thin border + rounded corners turn the page into a
  // distinct sheet on the paper. borderColor is applied per theme at the call site.
  framedPage: {
    borderWidth: 1.5,
    borderRadius: 8,
    overflow: "hidden",
  },
});

export default QuranReader;
