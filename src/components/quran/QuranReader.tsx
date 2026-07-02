import { useCallback, useEffect, useMemo, useRef } from "react";
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
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { MushafVersion, QuranThemeType, ReaderViewMode, SpreadFit } from "@/enums/quran";
import { TOTAL_PAGES, FONT_SIZE_MIN, FONT_SIZE_MAX } from "@/constants/Quran";
import {
  TOTAL_SPREADS,
  spreadOf,
  pagesOfSpread,
  clampPage,
  ReaderLayoutMode,
  fitWidthBox,
  fitPageBox,
  fitSpreadWidthBox,
  canvasFrame,
  CanvasMode,
  SPREAD_GUTTER,
  SPREAD_TOP_PAD,
} from "@/utils/readerSpread";
import { useReaderLayout } from "@/hooks/useReaderLayout";
import { useQuranStore } from "@/stores/quran";
import QuranPage from "@/components/quran/QuranPage";
import BookCanvas from "@/components/quran/BookCanvas";
import TextPage from "@/components/quran/TextPage";
import ReaderDebugGuides from "@/components/quran/ReaderDebugGuides";

// Dev-only measuring overlay for tuning the large-device layout.
const DEBUG_READER_GUIDES = false;

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
// Softer settle for large devices: the same spring over ~3× the travel distance reads as twitchy. Tuned on-device.
const TABLET_SPRING_CONFIG = { damping: 26, stiffness: 140, mass: 0.9 };
const PAGE_WINDOW = 2;
// How long a search-jump highlight stays on the target ayah before clearing.
const FLASH_CLEAR_MS = 2000;
// Turn shadow on the outgoing page's covered edge, peaking mid-drag.
const TURN_SHADOW_WIDTH = 28;
const TURN_SHADOW_PEAK = 0.25;

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
  // Only the image mushaf spreads; reflowed text reads better as one column.
  const isSpread = layout.mode === ReaderLayoutMode.SPREAD && readerMode !== ReaderViewMode.TEXT;
  // Large device showing one image page.
  const isLargeSingle =
    layout.mode === ReaderLayoutMode.SINGLE && layout.isLarge && readerMode !== ReaderViewMode.TEXT;
  // SCROLL: fit-width pages, each scrolling alone (a shared scroll would zigzag
  // against right-then-left reading). WHOLE: height-fit.
  const spreadFit = useQuranStore((s) => s.spreadFit);
  const spreadScrolls = isSpread && spreadFit === SpreadFit.SCROLL;
  // Modes where a vertical drag scrolls a page instead of turning it.
  const verticalScrolls = readerMode === ReaderViewMode.TEXT || isLargeSingle || spreadScrolls;
  // Session scroll memory, keyed "p"+page (single) / "sp"+page (spread pane).
  const scrollOffsets = useRef<Map<string, number>>(new Map());
  const totalUnits = isSpread ? TOTAL_SPREADS : TOTAL_PAGES;
  // Clamp a non-finite/out-of-range currentPage so the page window can't be empty (blank reader).
  const safePage = clampPage(currentPage);
  const currentUnit = isSpread ? spreadOf(safePage) : safePage;

  const insets = useSafeAreaInsets();
  // Vertical space a page can occupy on a large device (used by the aspect fit).
  const availPageHeight = height - SPREAD_TOP_PAD - insets.bottom;
  // BookCanvas backdrop — large image modes only.
  const showBookCanvas = layout.isLarge && readerMode !== ReaderViewMode.TEXT;
  // Tablet settle spring only for the large-device image reader.
  const settleSpring = showBookCanvas ? TABLET_SPRING_CONFIG : SPRING_CONFIG;
  const bookFrame = showBookCanvas
    ? canvasFrame({
        mode: isSpread
          ? spreadScrolls
            ? CanvasMode.SPREAD_SCROLL
            : CanvasMode.SPREAD
          : CanvasMode.FIT_WIDTH,
        width,
        screenHeight: height,
        availPageHeight,
      })
    : null;
  // Bottom strip owned by the system home-indicator gesture: vertical drags
  // there must not turn pages (horizontal turns stay allowed).
  const bottomDeadZone = insets.bottom + 24;
  // Single shared value for the page-turn drag offset (normalized: 0 = rest, 1 = one unit forward)
  const dragOffset = useSharedValue(0);
  const isHorizontal = useSharedValue<boolean | null>(null);
  // True when the active gesture began in the bottom home-indicator strip.
  const startedInBottomEdge = useSharedValue(false);
  const pinchBaseFontSize = useSharedValue(fontSize);
  // Committed unit index on the UI thread: a commit advances it and zeroes
  // dragOffset in one frame (React's currentUnit lags a frame behind).
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

      // Settle time scales with fling speed, easing out into place.
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
        dragOffset.value = withSpring(0, settleSpring);
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
        {bookFrame && (
          <BookCanvas width={width} height={height} theme={quranTheme} frame={bookFrame} />
        )}
        {unitWindow.map((unit) => (
          <PageSlot
            key={unit}
            unit={unit}
            isSpread={isSpread}
            spreadScrolls={spreadScrolls}
            isLargeSingle={isLargeSingle}
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
            turnShadow={showBookCanvas}
            onAyahLongPress={onAyahLongPress}
            onSurahLongPress={onSurahLongPress}
            onWaqfPress={onWaqfPress}
            selectedAyah={selectedAyah}
          />
        ))}
        {__DEV__ && DEBUG_READER_GUIDES && <ReaderDebugGuides />}
      </Animated.View>
    </GestureDetector>
  );
};

interface PageSlotProps {
  unit: number;
  isSpread: boolean;
  spreadScrolls: boolean;
  isLargeSingle: boolean;
  availPageHeight: number;
  scrollPadTop: number;
  scrollPadBottom: number;
  scrollOffsets: React.RefObject<Map<string, number>>;
  unitIndex: SharedValue<number>;
  version: MushafVersion;
  quranTheme: QuranThemeType;
  readerMode: ReaderViewMode;
  fontSize: number;
  dragOffset: SharedValue<number>;
  width: number;
  turnShadow: boolean;
  onAyahLongPress?: (surah: number, ayah: number) => void;
  onSurahLongPress?: (surah: number) => void;
  onWaqfPress?: (signId: string) => void;
  selectedAyah?: { surah: number; ayah: number } | null;
}

const PageSlot = ({
  unit,
  isSpread,
  spreadScrolls,
  isLargeSingle,
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
  turnShadow,
  onAyahLongPress,
  onSurahLongPress,
  onWaqfPress,
  selectedAyah,
}: PageSlotProps) => {
  // Fit-width single: restore the remembered offset once content is measured,
  // save on scroll. Plain functions — the React Compiler memoizes ref reads.
  const scrollRef = useRef<ScrollView>(null);
  const restoredScroll = useRef(false);
  const scrollKey = `p${unit}`;
  const onScrollContentSize = () => {
    if (restoredScroll.current) return;
    restoredScroll.current = true;
    const y = scrollOffsets.current?.get(scrollKey) ?? 0;
    if (y > 0) scrollRef.current?.scrollTo({ y, animated: false });
  };
  const onPageScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollOffsets.current?.set(scrollKey, e.nativeEvent.contentOffset.y);
  };

  const animatedStyle = useAnimatedStyle(() => {
    // unitOffset: 0 = current, -1 = next, +1 = prev; dragOffset: -1..1 drag.
    // UI-thread values only, so a turn updates position in one frame.
    const unitOffset = -(unit - unitIndex.value);
    const translateX = (unitOffset + dragOffset.value) * width;
    return { transform: [{ translateX }] };
  });

  // Shadow opacity peaks mid-turn (sin curve) and only on the outgoing slot.
  const leftShadowStyle = useAnimatedStyle(() => {
    const d = dragOffset.value;
    const active = unit === unitIndex.value && d > 0;
    return { opacity: active ? TURN_SHADOW_PEAK * Math.sin(Math.PI * Math.min(d, 1)) : 0 };
  });
  const rightShadowStyle = useAnimatedStyle(() => {
    const d = -dragOffset.value;
    const active = unit === unitIndex.value && d > 0;
    return { opacity: active ? TURN_SHADOW_PEAK * Math.sin(Math.PI * Math.min(d, 1)) : 0 };
  });

  const turnShadows = turnShadow ? (
    <>
      <Animated.View
        pointerEvents="none"
        style={[styles.turnShadow, styles.turnShadowLeft, leftShadowStyle]}>
        <LinearGradient
          colors={["rgba(0,0,0,0.45)", "transparent"]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        style={[styles.turnShadow, styles.turnShadowRight, rightShadowStyle]}>
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.45)"]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </>
  ) : null;

  const pageBoxStyle = (w: number, h: number) => ({ width: w, height: h });

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
    // Large single (portrait or landscape): fit the page to the (capped) width
    // and scroll it vertically — content fills the width edge-to-edge.
    const box = fitWidthBox(width);
    return (
      <Animated.View style={[styles.page, animatedStyle]}>
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
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
        {turnShadows}
      </Animated.View>
    );
  }

  // pagesOfSpread = [earlier, later]; RN flips the row under RTL, landing the
  // earlier page on the visual right.
  const pages = pagesOfSpread(unit);

  // SCROLL fit: two fit-width pages, each scrolling in its own ScrollView.
  if (spreadScrolls) {
    const box = fitSpreadWidthBox(width);
    return (
      <Animated.View style={[styles.page, animatedStyle]}>
        <View style={styles.spreadScrollRow}>
          {pages.map((p, i) => (
            <SpreadPane
              key={p}
              page={p}
              box={box}
              version={version}
              quranTheme={quranTheme}
              side={(i === 0) === I18nManager.isRTL ? "right" : "left"}
              scrollOffsets={scrollOffsets}
              padTop={scrollPadTop}
              padBottom={scrollPadBottom}
              onAyahLongPress={onAyahLongPress}
              onSurahLongPress={onSurahLongPress}
              selectedAyah={selectedAyah}
            />
          ))}
        </View>
        {turnShadows}
      </Animated.View>
    );
  }

  // WHOLE fit: height-fit pair, both full pages visible at once.
  const box = fitPageBox((width - SPREAD_GUTTER) / 2, availPageHeight);
  return (
    <Animated.View style={[styles.page, animatedStyle]}>
      <View style={styles.spreadRow}>
        {pages.map((p, i) => (
          <View key={p} style={pageBoxStyle(box.w, box.h)}>
            <QuranPage
              page={p}
              width={box.w}
              version={version}
              quranTheme={quranTheme}
              // RTL flips the row; the header side prop matches.
              side={(i === 0) === I18nManager.isRTL ? "right" : "left"}
              onAyahLongPress={onAyahLongPress}
              onSurahLongPress={onSurahLongPress}
              selectedAyah={selectedAyah}
            />
          </View>
        ))}
      </View>
      {turnShadows}
    </Animated.View>
  );
};

interface SpreadPaneProps {
  page: number;
  box: { w: number; h: number };
  version: MushafVersion;
  quranTheme: QuranThemeType;
  side: "left" | "right";
  scrollOffsets: React.RefObject<Map<string, number>>;
  padTop: number;
  padBottom: number;
  onAyahLongPress?: (surah: number, ayah: number) => void;
  onSurahLongPress?: (surah: number) => void;
  selectedAyah?: { surah: number; ayah: number } | null;
}

// One independently-scrolling page of a SCROLL-fit spread ("sp" scroll keys).
const SpreadPane = ({
  page,
  box,
  version,
  quranTheme,
  side,
  scrollOffsets,
  padTop,
  padBottom,
  onAyahLongPress,
  onSurahLongPress,
  selectedAyah,
}: SpreadPaneProps) => {
  const scrollRef = useRef<ScrollView>(null);
  const restoredScroll = useRef(false);
  const scrollKey = `sp${page}`;
  const onScrollContentSize = () => {
    if (restoredScroll.current) return;
    restoredScroll.current = true;
    const y = scrollOffsets.current?.get(scrollKey) ?? 0;
    if (y > 0) scrollRef.current?.scrollTo({ y, animated: false });
  };
  const onPaneScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollOffsets.current?.set(scrollKey, e.nativeEvent.contentOffset.y);
  };
  return (
    <ScrollView
      ref={scrollRef}
      style={{ width: box.w, flexGrow: 0 }}
      contentContainerStyle={{ paddingTop: padTop, paddingBottom: padBottom }}
      showsVerticalScrollIndicator={false}
      scrollEventThrottle={16}
      onScroll={onPaneScroll}
      onContentSizeChange={onScrollContentSize}>
      <View style={{ width: box.w, height: box.h }}>
        <QuranPage
          page={page}
          width={box.w}
          version={version}
          quranTheme={quranTheme}
          side={side}
          onAyahLongPress={onAyahLongPress}
          onSurahLongPress={onSurahLongPress}
          selectedAyah={selectedAyah}
        />
      </View>
    </ScrollView>
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
  spreadRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: SPREAD_TOP_PAD,
    gap: SPREAD_GUTTER,
  },
  // SCROLL-fit spread: the two independently-scrolling panes sit side by side.
  spreadScrollRow: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    gap: SPREAD_GUTTER,
  },
  turnShadow: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: TURN_SHADOW_WIDTH,
  },
  turnShadowLeft: { left: 0 },
  turnShadowRight: { right: 0 },
});

export default QuranReader;
