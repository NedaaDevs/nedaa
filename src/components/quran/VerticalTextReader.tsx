import { useCallback, useEffect, useMemo, useRef } from "react";
import { View, ViewToken } from "react-native";
import Animated, { runOnUI } from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { QuranThemeType } from "@/enums/quran";
import { QURAN_THEME_COLORS, TOTAL_PAGES } from "@/constants/Quran";
import { useQuranStore } from "@/stores/quran";
import { useAutoScroll } from "@/hooks/useAutoScroll";
import { useAudioFollowTarget } from "@/hooks/useAudioFollowTarget";
import TextPage from "@/components/quran/TextPage";

// Every mushaf page number, hoisted so the list data isn't reallocated per render.
const ALL_PAGES = Array.from({ length: TOTAL_PAGES }, (_, i) => i + 1);
const pageKey = (page: number) => String(page);

// A page counts as "current" once it fills at least half the viewport.
const VIEWABILITY_CONFIG = { itemVisiblePercentThreshold: 50 };
// Backdrop gap between stacked pages, so each text page reads as its own card.
const PAGE_GAP = 10;

interface VerticalTextReaderProps {
  width: number;
  currentPage: number;
  quranTheme: QuranThemeType;
  fontSize: number;
  onPageChange: (page: number) => void;
  onTap?: () => void;
  onAyahLongPress?: (surah: number, ayah: number) => void;
  onSurahLongPress?: (surah: number) => void;
  onWaqfPress?: (signId: string) => void;
  selectedAyah?: { surah: number; ayah: number } | null;
}

// Continuous vertical reader for Text mode. Text reflows, so page heights are
// unknown until layout — no getItemLayout; resume jumps via onScrollToIndexFailed
// with the list's measured average. Each page keeps its own header/footer over a
// backdrop gap, so pages stay visually distinct rather than one endless column.
const VerticalTextReader = ({
  width,
  currentPage,
  quranTheme,
  fontSize,
  onPageChange,
  onTap,
  onAyahLongPress,
  onSurahLongPress,
  onWaqfPress,
  selectedAyah,
}: VerticalTextReaderProps) => {
  const insets = useSafeAreaInsets();
  const themeColors = QURAN_THEME_COLORS[quranTheme];

  // Auto-scroll glide: driven on the UI thread. A manual drag only pauses it while
  // touched (auto-resumes); reaching the end stops it. The animated ref doubles as
  // the list ref used for resume-jump scrolling below.
  const playing = useQuranStore((s) => s.autoScrollPlaying);
  const pxPerSec = useQuranStore((s) => s.autoScrollSpeed);
  const setAutoScrollPlaying = useQuranStore((s) => s.setAutoScrollPlaying);
  const pause = useCallback(() => setAutoScrollPlaying(false), [setAutoScrollPlaying]);
  const { animatedRef, scrollHandler, syncToLive, liveOffset, maxOffset } = useAutoScroll<number>({
    playing,
    pxPerSec,
    onReachEnd: pause,
  });

  // Index-based jumps can't pre-compute a pixel offset (variable page heights), so
  // after any jump the glide re-seeds from the list's settled position — otherwise
  // auto-scroll drags the view back to where it was.
  const settleGlide = useCallback(() => {
    setTimeout(syncToLive, 120);
  }, [syncToLive]);

  // Read-along follow: text reflows, so there's no pixel target for a line — the
  // reliable unit is the page. When the recited verse moves onto a page that isn't
  // the one on screen, flip to it; within a page the verse tint tracks position.
  const followTarget = useAudioFollowTarget();
  const retriedIndexRef = useRef(-1);
  const visiblePageRef = useRef(currentPage);
  const lastFollowPageRef = useRef(0);
  // The recited page, for the auto-scroll freeze below (0 = no reader recitation).
  const followPageRef = useRef(0);
  useEffect(() => {
    followPageRef.current = followTarget?.page ?? 0;
    // Recitation advanced (or stopped): lift any freeze; the viewability handler
    // re-freezes if the view is still ahead of the recited page.
    runOnUI(() => {
      "worklet";
      maxOffset.value = Number.MAX_SAFE_INTEGER;
    })();
    if (!followTarget) {
      lastFollowPageRef.current = 0;
      return;
    }
    const page = followTarget.page;
    if (page === lastFollowPageRef.current) return; // already handled this page
    lastFollowPageRef.current = page;
    if (page === visiblePageRef.current) return; // recited verse already on screen
    retriedIndexRef.current = -1;
    animatedRef.current?.scrollToIndex({ index: page - 1, animated: true, viewPosition: 0 });
    settleGlide();
  }, [followTarget, animatedRef, settleGlide, maxOffset]);

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
  const onViewableItemsChanged = useMemo(
    () =>
      ({ viewableItems }: { viewableItems: ViewToken[] }) => {
        const top = viewableItems[0]?.index;
        if (top != null) {
          visiblePageRef.current = top + 1;
          onPageChangeRef.current(top + 1);
          // Text pages have no line pixels to cap against, so the read-along cap is
          // page-grained: once the view runs ahead of the recited page, park the
          // glide where it is; the follow effect lifts this as recitation advances.
          const ahead = followPageRef.current > 0 && top + 1 > followPageRef.current;
          runOnUI(() => {
            "worklet";
            maxOffset.value = ahead ? liveOffset.value : Number.MAX_SAFE_INTEGER;
          })();
        }
      },
    [maxOffset, liveOffset]
  );

  // External page jumps (search, goto, slider) command currentPage from outside;
  // scroll to them. Self-reported pages (the user scrolling) echo back as the same
  // value as visiblePageRef and are ignored, so the list never fights a drag.
  useEffect(() => {
    if (currentPage === visiblePageRef.current) return;
    retriedIndexRef.current = -1; // fresh jump → allow one exact-position retry
    animatedRef.current?.scrollToIndex({ index: currentPage - 1, animated: false });
    settleGlide();
  }, [currentPage, animatedRef, settleGlide]);

  // Resume jump: with variable heights the target isn't measured yet, so land on
  // the list's estimated offset, then settle onto the exact page once it renders.
  // One retry per jumped-to index — a still-unmeasured target after that keeps the
  // estimated landing rather than re-firing this handler forever.
  const onScrollToIndexFailed = useCallback(
    (info: { index: number; averageItemLength: number }) => {
      animatedRef.current?.scrollToOffset({
        offset: info.averageItemLength * info.index,
        animated: false,
      });
      if (retriedIndexRef.current === info.index) {
        settleGlide();
        return;
      }
      retriedIndexRef.current = info.index;
      setTimeout(() => {
        animatedRef.current?.scrollToIndex({ index: info.index, animated: false });
        settleGlide();
      }, 350);
    },
    [animatedRef, settleGlide]
  );

  const separator = useCallback(
    () => <View style={{ height: PAGE_GAP, backgroundColor: themeColors.canvasOuter }} />,
    [themeColors.canvasOuter]
  );

  const renderItem = useCallback(
    ({ item }: { item: number }) => (
      <TextPage
        page={item}
        width={width}
        quranTheme={quranTheme}
        fontSize={fontSize}
        flow
        onAyahLongPress={onAyahLongPress}
        onSurahLongPress={onSurahLongPress}
        onWaqfPress={onWaqfPress}
        selectedAyah={selectedAyah}
      />
    ),
    [width, quranTheme, fontSize, onAyahLongPress, onSurahLongPress, onWaqfPress, selectedAyah]
  );

  return (
    <GestureDetector gesture={tapGesture}>
      <Animated.FlatList
        ref={animatedRef}
        data={ALL_PAGES}
        keyExtractor={pageKey}
        renderItem={renderItem}
        ItemSeparatorComponent={separator}
        initialScrollIndex={Math.max(0, currentPage - 1)}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        onScrollToIndexFailed={onScrollToIndexFailed}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={VIEWABILITY_CONFIG}
        showsVerticalScrollIndicator={false}
        style={{ backgroundColor: themeColors.canvasOuter }}
        contentContainerStyle={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
        windowSize={5}
        initialNumToRender={2}
        maxToRenderPerBatch={2}
        removeClippedSubviews
      />
    </GestureDetector>
  );
};

export default VerticalTextReader;
