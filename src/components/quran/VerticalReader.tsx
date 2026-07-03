import { useCallback, useEffect, useMemo, useRef } from "react";
import { View, ViewToken } from "react-native";
import Animated from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MushafVersion, QuranThemeType } from "@/enums/quran";
import { TOTAL_PAGES } from "@/constants/Quran";
import { fitWidthBox } from "@/utils/readerSpread";
import { useQuranStore } from "@/stores/quran";
import { useAutoScroll } from "@/hooks/useAutoScroll";
import QuranPage from "@/components/quran/QuranPage";

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
  const box = fitWidthBox(width);
  const itemHeight = box.h + PAGE_GAP;

  // Auto-scroll glide: driven on the UI thread. A manual drag only pauses it while
  // touched (auto-resumes); reaching the end stops it in the store.
  const playing = useQuranStore((s) => s.autoScrollPlaying);
  const pxPerSec = useQuranStore((s) => s.autoScrollSpeed);
  const setAutoScrollPlaying = useQuranStore((s) => s.setAutoScrollPlaying);
  const pause = useCallback(() => setAutoScrollPlaying(false), [setAutoScrollPlaying]);
  const { animatedRef, scrollHandler } = useAutoScroll<number>({
    playing,
    pxPerSec,
    onReachEnd: pause,
  });

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
        if (top != null) onPageChangeRef.current(top + 1);
      },
    []
  );

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
