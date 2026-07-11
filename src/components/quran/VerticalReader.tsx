import { useCallback, useEffect, useMemo, useRef } from "react";
import { useWindowDimensions, View, ViewToken } from "react-native";
import Animated, { runOnUI, scrollTo } from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MushafVersion, QuranThemeType } from "@/enums/quran";
import { TOTAL_PAGES, LINES_PER_PAGE } from "@/constants/Quran";
import { fitWidthBox } from "@/utils/readerSpread";
import { useQuranStore } from "@/stores/quran";
import { useAutoScroll } from "@/hooks/useAutoScroll";
import { useAudioFollowTarget } from "@/hooks/useAudioFollowTarget";
import { AppLogger } from "@/utils/appLogger";
import QuranPage from "@/components/quran/QuranPage";

const log = AppLogger.create("quran-follow");

// Every mushaf page number, hoisted so the list data isn't reallocated per render.
const ALL_PAGES = Array.from({ length: TOTAL_PAGES }, (_, i) => i + 1);
const pageKey = (page: number) => String(page);

// A page counts as "current" once it fills at least half the viewport.
const VIEWABILITY_CONFIG = { itemVisiblePercentThreshold: 50 };
// Breathing room between stacked pages so consecutive footers/headers don't touch.
const PAGE_GAP = 16;

interface VerticalReaderProps {
  width: number;
  currentPage: number;
  version: MushafVersion;
  quranTheme: QuranThemeType;
  onPageChange: (page: number) => void;
  onTap?: () => void;
  onAyahLongPress?: (surah: number, ayah: number) => void;
  onSurahLongPress?: (surah: number) => void;
  selectedAyah?: { surah: number; ayah: number } | null;
}

// Continuous vertical reader: each page is a distinct full-width unit (its own
// header/footer) stacked in one scroller. This is the mode auto-scroll drives.
const VerticalReader = ({
  width,
  currentPage,
  version,
  quranTheme,
  onPageChange,
  onTap,
  onAyahLongPress,
  onSurahLongPress,
  selectedAyah,
}: VerticalReaderProps) => {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const box = fitWidthBox(width);
  const itemHeight = box.h + PAGE_GAP;
  const lineHeightInPage = box.h / LINES_PER_PAGE;

  // Auto-scroll glide: driven on the UI thread. A manual drag only pauses it while
  // touched (auto-resumes); reaching the end stops it in the store.
  const playing = useQuranStore((s) => s.autoScrollPlaying);
  const pxPerSec = useQuranStore((s) => s.autoScrollSpeed);
  const setAutoScrollPlaying = useQuranStore((s) => s.setAutoScrollPlaying);
  const pause = useCallback(() => setAutoScrollPlaying(false), [setAutoScrollPlaying]);
  const { animatedRef, scrollHandler, liveOffset, layoutH, maxOffset, glideTarget, jumpTo } =
    useAutoScroll<number>({
      playing,
      pxPerSec,
      // Matches getItemLayout's offset for the current page (index = page − 1).
      initialOffset: itemHeight * Math.max(0, currentPage - 1),
      onReachEnd: pause,
    });

  // Read-along follow: keep the recited line on screen. Only nudges when the line
  // drifts outside a comfortable band (top ~20% … bottom ~30%); a line already in
  // view is left alone so a short surah that fits the screen never scrolls. Fires on
  // line change only (not per word on the same line).
  const followTarget = useAudioFollowTarget();
  const lastFollowRef = useRef("");
  useEffect(() => {
    if (!followTarget) {
      lastFollowRef.current = "";
      runOnUI(() => {
        "worklet";
        maxOffset.value = Number.MAX_SAFE_INTEGER; // no recitation → uncapped glide
      })();
      return;
    }
    const key = `${followTarget.page}:${followTarget.line}`;
    if (key === lastFollowRef.current) return;
    lastFollowRef.current = key;
    // Absolute Y of the line's top within the scroller (paddingTop + page + line).
    const lineTop =
      insets.top +
      itemHeight * (followTarget.page - 1) +
      (followTarget.line - 1) * lineHeightInPage;
    log.d(
      "Follow",
      `${followTarget.surah}:${followTarget.ayah} p${followTarget.page} l${followTarget.line} lineTop=${Math.round(lineTop)}`
    );
    runOnUI(() => {
      "worklet";
      // While recitation drives the view, the teleprompter creep parks entirely —
      // all movement comes from the discrete nudge below (stop → glide → stop
      // reads better than a constant crawl pinned under the highlight).
      maxOffset.value = 0;
      const viewportY = lineTop - liveOffset.value;
      const view = layoutH.value || height;
      // In-band → leave it; the line is already comfortably visible.
      if (viewportY >= view * 0.2 && viewportY <= view * 0.7) return;
      const dest = Math.max(0, lineTop - view * 0.35);
      glideTarget.value = dest; // keep the auto-scroll glide in step with the follow
      scrollTo(animatedRef, 0, dest, true);
    })();
  }, [
    followTarget,
    insets.top,
    itemHeight,
    lineHeightInPage,
    height,
    animatedRef,
    liveOffset,
    layoutH,
    maxOffset,
    glideTarget,
  ]);

  // A single tap toggles the reader chrome (top bar / page slider), same as the
  // page-turn reader. Runs on JS so it can call the prop directly; coexists with
  // the list's native scroll (fires only on a tap, not a drag).
  const tapGesture = useMemo(
    () =>
      Gesture.Tap()
        .runOnJS(true)
        .onEnd(() => onTap?.()),
    [onTap]
  );

  // Report the top visible page so the store (header + resume) stays in sync.
  // onViewableItemsChanged must be referentially stable, so read the latest
  // callback through a ref instead of recreating the handler.
  const onPageChangeRef = useRef(onPageChange);
  useEffect(() => {
    onPageChangeRef.current = onPageChange;
  }, [onPageChange]);
  const visiblePageRef = useRef(currentPage);
  const onViewableItemsChanged = useMemo(
    () =>
      ({ viewableItems }: { viewableItems: ViewToken[] }) => {
        const top = viewableItems[0]?.index;
        if (top != null) {
          visiblePageRef.current = top + 1;
          onPageChangeRef.current(top + 1);
        }
      },
    []
  );

  // External page jumps (search, goto, slider) command currentPage from outside;
  // jump the list AND the glide there (or auto-scroll drags the view back). Self-
  // reported pages (the user scrolling) echo back equal to visiblePageRef and are
  // ignored, so the list never fights a drag.
  useEffect(() => {
    if (currentPage === visiblePageRef.current) return;
    jumpTo(itemHeight * Math.max(0, currentPage - 1));
  }, [currentPage, itemHeight, jumpTo]);

  const renderItem = useCallback(
    ({ item }: { item: number }) => (
      <View style={{ height: itemHeight, width, alignItems: "center", justifyContent: "center" }}>
        <View style={{ width: box.w, height: box.h }}>
          <QuranPage
            page={item}
            width={box.w}
            version={version}
            quranTheme={quranTheme}
            onAyahLongPress={onAyahLongPress}
            onSurahLongPress={onSurahLongPress}
            selectedAyah={selectedAyah}
          />
        </View>
      </View>
    ),
    [
      itemHeight,
      width,
      box.w,
      box.h,
      version,
      quranTheme,
      onAyahLongPress,
      onSurahLongPress,
      selectedAyah,
    ]
  );

  return (
    <GestureDetector gesture={tapGesture}>
      <Animated.FlatList
        ref={animatedRef}
        data={ALL_PAGES}
        keyExtractor={pageKey}
        renderItem={renderItem}
        getItemLayout={(_, index) => ({ length: itemHeight, offset: itemHeight * index, index })}
        initialScrollIndex={Math.max(0, currentPage - 1)}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={VIEWABILITY_CONFIG}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
        windowSize={5}
        maxToRenderPerBatch={3}
        removeClippedSubviews
      />
    </GestureDetector>
  );
};

export default VerticalReader;
