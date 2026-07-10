import { useCallback, useEffect, useMemo, useRef } from "react";
import { View, ViewToken } from "react-native";
import Animated from "react-native-reanimated";
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
  const { animatedRef, scrollHandler } = useAutoScroll<number>({
    playing,
    pxPerSec,
    onReachEnd: pause,
  });

  // Read-along follow: text reflows, so there's no pixel target for a line — the
  // reliable unit is the page. When the recited verse moves onto a page that isn't
  // the one on screen, flip to it; within a page the verse tint tracks position.
  const followTarget = useAudioFollowTarget();
  const visiblePageRef = useRef(currentPage);
  const lastFollowPageRef = useRef(0);
  useEffect(() => {
    if (!followTarget) {
      lastFollowPageRef.current = 0;
      return;
    }
    const page = followTarget.page;
    if (page === lastFollowPageRef.current) return; // already handled this page
    lastFollowPageRef.current = page;
    if (page === visiblePageRef.current) return; // recited verse already on screen
    animatedRef.current?.scrollToIndex({ index: page - 1, animated: true, viewPosition: 0 });
  }, [followTarget, animatedRef]);

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
        }
      },
    []
  );

  // Resume jump: with variable heights the target isn't measured yet, so land on
  // the list's estimated offset, then settle onto the exact page once it renders.
  const onScrollToIndexFailed = useCallback(
    (info: { index: number; averageItemLength: number }) => {
      animatedRef.current?.scrollToOffset({
        offset: info.averageItemLength * info.index,
        animated: false,
      });
      setTimeout(() => {
        animatedRef.current?.scrollToIndex({ index: info.index, animated: false });
      }, 350);
    },
    [animatedRef]
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
