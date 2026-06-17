import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LayoutChangeEvent, Pressable, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { scheduleOnRN } from "react-native-worklets";
import { YStack } from "tamagui";

import { BookmarkColor, HighlightColor, MushafVersion, QuranThemeType } from "@/enums/quran";
import {
  LINES_PER_PAGE,
  QURAN_THEME_COLORS,
  IMAGE_SOURCE_WIDTH,
  IMAGE_SOURCE_LINE_HEIGHT,
  highlightTint,
  BOOKMARK_COLORS,
} from "@/constants/Quran";
import { localizedSurahName } from "@/utils/surahName";
import { usePageData } from "@/hooks/usePageData";
import { useAyahHitTest } from "@/hooks/useAyahHitTest";
import { useHighlightStore } from "@/stores/quranHighlights";
import { useBookmarkStore } from "@/stores/quranBookmarks";
import { useQuranStore } from "@/stores/quran";
import { useMutashabihatKeys } from "@/hooks/useMutashabihatKeys";
import LineImage from "@/components/quran/LineImage";
import PageImage from "@/components/quran/PageImage";
import LineShimmer from "@/components/quran/LineShimmer";
import PageHeader from "@/components/quran/PageHeader";
import PageNumber from "@/components/quran/PageNumber";
import AyahMarker from "@/components/quran/AyahMarker";

const LONG_PRESS_MS = 400;
// Must exceed the page-swipe pan's minDistance(15) to avoid a no-op jitter band.
const LONG_PRESS_MAX_DIST = 20;

interface QuranPageProps {
  page: number;
  version: MushafVersion;
  quranTheme: QuranThemeType;
  width: number;
  // Spread page side for the running header (surah → outer edge). Default single.
  side?: "left" | "right" | "single";
  onAyahLongPress?: (surah: number, ayah: number) => void;
  onSurahLongPress?: (surah: number) => void;
  selectedAyah?: { surah: number; ayah: number } | null;
}

// Constant 1..15 line numbers — hoisted so it isn't reallocated every render.
const PAGE_LINE_NUMBERS = Array.from({ length: LINES_PER_PAGE }, (_, i) => i + 1);

const QuranPage = ({
  page,
  version,
  quranTheme,
  width,
  side,
  onAyahLongPress,
  onSurahLongPress,
  selectedAyah,
}: QuranPageProps) => {
  // Start at 0 so every line image + overlay (markers, tints, ribbons) waits for
  // the real onLayout height — they're all guarded by `lineHeight > 0`. Seeding an
  // estimate here made them render once at the wrong position then snap on measure.
  const [linesAreaHeight, setLinesAreaHeight] = useState(0);
  const pressableRef = useRef<View>(null);

  const {
    pageAvailable,
    isPageMode,
    surahHeaderLines,
    juz,
    glyphBounds,
    sourcePageHeight,
    pageDataLoaded,
  } = usePageData(version, page);

  // The page image and its ayah markers render together only once glyph data has
  // loaded — otherwise the image shows first and markers pop in a beat later.
  const ready = pageAvailable && pageDataLoaded;

  const onLinesLayout = useCallback((event: LayoutChangeEvent) => {
    setLinesAreaHeight(event.nativeEvent.layout.height);
  }, []);

  // --- Scaling math ---
  // coverScale: how the source image width maps to screen width
  const coverScale = width / IMAGE_SOURCE_WIDTH;
  // lineHeight: screen height allocated per line slot
  const lineHeight = linesAreaHeight > 0 ? Math.floor(linesAreaHeight / LINES_PER_PAGE) : 0;

  // For LINE mode: each line image scales independently
  const scaledLineHeight = IMAGE_SOURCE_LINE_HEIGHT * coverScale;
  const lineCoverClipY = (scaledLineHeight - lineHeight) / 2;

  // For PAGE mode: image scaled by width then compressed vertically via scaleY
  const pageScaleX = width / IMAGE_SOURCE_WIDTH;
  const srcLineHeight =
    sourcePageHeight > 0 ? sourcePageHeight / LINES_PER_PAGE : IMAGE_SOURCE_LINE_HEIGHT;
  const scaledPageHeight =
    sourcePageHeight > 0 ? Math.round(sourcePageHeight * pageScaleX) : linesAreaHeight;
  const pageScaleY = scaledPageHeight > 0 ? linesAreaHeight / scaledPageHeight : 1;

  const geometry = useMemo(
    () => ({
      isPageMode,
      coverScale,
      lineHeight,
      lineCoverClipY,
      pageScaleX,
      pageScaleY,
      srcLineHeight,
    }),
    [isPageMode, coverScale, lineHeight, lineCoverClipY, pageScaleX, pageScaleY, srcLineHeight]
  );

  const { highlightedAyah, clearHighlight, handlePress, handleLongPress } = useAyahHitTest({
    version,
    page,
    glyphBounds,
    surahHeaderLines,
    geometry,
    pressableRef,
    onAyahLongPress,
    onSurahLongPress,
  });

  // Long-press as a native RNGH gesture so it coordinates with the page-swipe pan
  // instead of a JS Pressable, whose long-press the pan could cancel on Android.
  const longPressGesture = useMemo(
    () =>
      Gesture.LongPress()
        .minDuration(LONG_PRESS_MS)
        .maxDistance(LONG_PRESS_MAX_DIST)
        // onStart runs as a worklet on the UI thread; hop to JS for the hit-test.
        .onStart((e) => scheduleOnRN(handleLongPress, e.absoluteX, e.absoluteY)),
    [handleLongPress]
  );

  // Drop the highlight when the ayah's action sheet closes (selection cleared).
  useEffect(() => {
    if (!selectedAyah) clearHighlight();
  }, [selectedAyah, clearHighlight]);

  // Header surah is derived from the page's own glyphs (each carries its
  // surahNumber), so continuation pages show the running surah — and it's
  // naturally blank while the page is still downloading (no glyphs yet).
  const headerSurah = useMemo(() => {
    if (!pageAvailable || glyphBounds.length === 0) return "";
    const topSurah = glyphBounds.reduce((min, g) => Math.min(min, g.surahNumber), Infinity);
    return localizedSurahName(topSurah);
  }, [pageAvailable, glyphBounds]);

  // Highlighted ayahs present on this page, keyed "surah:ayah" → colour. Matched
  // by glyph membership (not the stored page) so an ayah that spills across a
  // page boundary still tints on both pages.
  const highlights = useHighlightStore((s) => s.highlights);
  const pageHighlights = useMemo(() => {
    const map = new Map<string, HighlightColor>();
    if (glyphBounds.length === 0 || highlights.length === 0) return map;
    const present = new Set(glyphBounds.map((g) => `${g.surahNumber}:${g.ayahNumber}`));
    for (const h of highlights) {
      const key = `${h.surah}:${h.ayah}`;
      if (present.has(key)) map.set(key, h.color);
    }
    return map;
  }, [highlights, glyphBounds]);

  // Bookmarked ayahs present on this page, keyed "surah:ayah" → ribbon colour.
  const bookmarks = useBookmarkStore((s) => s.bookmarks);
  const pageBookmarks = useMemo(() => {
    const map = new Map<string, BookmarkColor>();
    if (glyphBounds.length === 0 || bookmarks.length === 0) return map;
    const present = new Set(glyphBounds.map((g) => `${g.surahNumber}:${g.ayahNumber}`));
    for (const b of bookmarks) {
      const key = `${b.surah}:${b.ayah}`;
      if (present.has(key)) map.set(key, b.color);
    }
    return map;
  }, [bookmarks, glyphBounds]);

  // Screen-space rects covering an ayah's glyphs, one per line it occupies.
  const rectsForAyah = useCallback(
    (surah: number, ayah: number) => {
      if (lineHeight === 0) return [];
      const ayahGlyphs = glyphBounds.filter(
        (g) => g.surahNumber === surah && g.ayahNumber === ayah
      );
      if (ayahGlyphs.length === 0) return [];

      const lineMap = new Map<number, { minX: number; maxX: number }>();
      for (const g of ayahGlyphs) {
        const existing = lineMap.get(g.line);
        const gRight = g.x + g.width;
        if (existing) {
          existing.minX = Math.min(existing.minX, g.x);
          existing.maxX = Math.max(existing.maxX, gRight);
        } else {
          lineMap.set(g.line, { minX: g.x, maxX: gRight });
        }
      }

      if (isPageMode) {
        return Array.from(lineMap.entries()).map(([line, { minX, maxX }]) => ({
          left: minX * pageScaleX,
          top: (line - 1) * srcLineHeight * pageScaleX * pageScaleY,
          width: (maxX - minX) * pageScaleX,
          height: srcLineHeight * pageScaleX * pageScaleY,
        }));
      }

      return Array.from(lineMap.entries()).map(([line, { minX, maxX }]) => ({
        left: minX * coverScale,
        top: (line - 1) * lineHeight,
        width: (maxX - minX) * coverScale,
        height: lineHeight,
      }));
    },
    [glyphBounds, lineHeight, isPageMode, pageScaleX, pageScaleY, srcLineHeight, coverScale]
  );

  // Transient long-press highlight; skipped when the ayah is highlighted (its
  // persistent colour tint already covers it).
  const highlightRects = useMemo(() => {
    if (!highlightedAyah) return [];
    if (pageHighlights.has(`${highlightedAyah.surah}:${highlightedAyah.ayah}`)) return [];
    return rectsForAyah(highlightedAyah.surah, highlightedAyah.ayah);
  }, [highlightedAyah, pageHighlights, rectsForAyah]);

  // Search-jump highlight: tint the target ayah's word-rects like a long-press
  // selection; QuranReader clears `flashAyah` after a couple of seconds. Skipped
  // when the ayah is a saved highlight (its colour tint already marks it).
  const flashAyah = useQuranStore((s) => s.flashAyah);
  const flashRects = useMemo(() => {
    if (!flashAyah) return [];
    if (pageHighlights.has(`${flashAyah.surah}:${flashAyah.ayah}`)) return [];
    return rectsForAyah(flashAyah.surah, flashAyah.ayah);
  }, [flashAyah, pageHighlights, rectsForAyah]);

  // Persistent per-highlight colour tints.
  const highlightTintRects = useMemo(() => {
    const out: { left: number; top: number; width: number; height: number; tint: string }[] = [];
    for (const [key, color] of pageHighlights) {
      const [surah, ayah] = key.split(":").map(Number);
      for (const r of rectsForAyah(surah, ayah)) {
        out.push({ ...r, tint: highlightTint(color, quranTheme) });
      }
    }
    return out;
  }, [pageHighlights, rectsForAyah, quranTheme]);

  const markerPositions = useMemo(() => {
    if (lineHeight === 0) return [];
    const markers = glyphBounds.filter((g) => g.isMarker);
    return markers.map((g) => {
      if (isPageMode) {
        return {
          x: g.x * pageScaleX,
          y: (g.line - 1) * srcLineHeight * pageScaleX * pageScaleY + g.y * pageScaleX * pageScaleY,
          width: g.width * pageScaleX,
          height: g.height * pageScaleX * pageScaleY,
          surahNumber: g.surahNumber,
          ayahNumber: g.ayahNumber,
        };
      }
      return {
        x: g.x * coverScale,
        y: (g.line - 1) * lineHeight + g.y * coverScale - lineCoverClipY,
        width: g.width * coverScale,
        height: g.height * coverScale,
        surahNumber: g.surahNumber,
        ayahNumber: g.ayahNumber,
      };
    });
  }, [
    glyphBounds,
    lineHeight,
    isPageMode,
    coverScale,
    lineCoverClipY,
    pageScaleX,
    pageScaleY,
    srcLineHeight,
  ]);

  // Similar-verse markers ("huffaz mode", off by default): a small dot above the
  // ayah's end-marker for any verse on this page that belongs to a group.
  const mutashabihatKeys = useMutashabihatKeys(page);
  const mutashabihatDots = useMemo(
    () =>
      mutashabihatKeys.size === 0
        ? []
        : markerPositions.filter((m) => mutashabihatKeys.has(`${m.surahNumber}:${m.ayahNumber}`)),
    [markerPositions, mutashabihatKeys]
  );

  return (
    <YStack
      flex={1}
      width={width}
      style={{ backgroundColor: QURAN_THEME_COLORS[quranTheme].background }}>
      <PageHeader
        surahName={headerSurah}
        juz={pageAvailable ? juz : null}
        quranTheme={quranTheme}
        side={side}
      />

      <View
        style={{
          flex: 1,
          alignItems: "center",
          backgroundColor: QURAN_THEME_COLORS[quranTheme].innerBackground,
        }}
        onLayout={onLinesLayout}>
        <GestureDetector gesture={longPressGesture}>
          <Pressable
            ref={pressableRef}
            style={{
              position: "relative",
              direction: "ltr",
            }}
            onPress={handlePress}>
            {lineHeight > 0 && ready && isPageMode && (
              <PageImage
                version={version}
                page={page}
                screenWidth={width}
                availableHeight={linesAreaHeight}
                quranTheme={quranTheme}
              />
            )}
            {lineHeight > 0 && !ready && isPageMode && (
              <LineShimmer
                screenWidth={width}
                lineHeight={linesAreaHeight}
                quranTheme={quranTheme}
              />
            )}
            {lineHeight > 0 &&
              !isPageMode &&
              PAGE_LINE_NUMBERS.map((line) =>
                ready ? (
                  <LineImage
                    key={`${page}-${line}`}
                    version={version}
                    page={page}
                    line={line}
                    screenWidth={width}
                    lineHeight={lineHeight}
                    quranTheme={quranTheme}
                  />
                ) : (
                  <LineShimmer
                    key={`shimmer-${page}-${line}`}
                    screenWidth={width}
                    lineHeight={lineHeight}
                    quranTheme={quranTheme}
                  />
                )
              )}

            {highlightTintRects.map((rect, i) => (
              <View
                key={`hl-tint-${i}`}
                style={{
                  position: "absolute",
                  left: rect.left,
                  top: rect.top,
                  width: rect.width,
                  height: rect.height,
                  backgroundColor: rect.tint,
                  borderRadius: 2,
                }}
              />
            ))}

            {ready &&
              markerPositions.map((m, i) => {
                const bmColor = pageBookmarks.get(`${m.surahNumber}:${m.ayahNumber}`);
                return (
                  <AyahMarker
                    key={`marker-${i}`}
                    x={m.x}
                    y={m.y}
                    width={m.width}
                    height={m.height}
                    ayahNumber={m.ayahNumber}
                    version={version}
                    quranTheme={quranTheme}
                    bookmarkColor={bmColor ? BOOKMARK_COLORS[bmColor].solid : undefined}
                  />
                );
              })}

            {highlightRects.map((rect, i) => (
              <View
                key={`hl-${i}`}
                style={{
                  position: "absolute",
                  left: rect.left,
                  top: rect.top,
                  width: rect.width,
                  height: rect.height,
                  backgroundColor: QURAN_THEME_COLORS[quranTheme].highlightColor,
                  borderRadius: 2,
                }}
              />
            ))}

            {flashRects.map((rect, i) => (
              <View
                key={`flash-${i}`}
                pointerEvents="none"
                style={{
                  position: "absolute",
                  left: rect.left,
                  top: rect.top,
                  width: rect.width,
                  height: rect.height,
                  backgroundColor: QURAN_THEME_COLORS[quranTheme].highlightColor,
                  borderRadius: 2,
                }}
              />
            ))}

            {mutashabihatDots.map((m, i) => (
              <View
                key={`mut-${i}`}
                pointerEvents="none"
                style={{
                  position: "absolute",
                  left: m.x + m.width / 2 - 2.5,
                  top: m.y - 5,
                  width: 5,
                  height: 5,
                  borderRadius: 2.5,
                  backgroundColor: QURAN_THEME_COLORS[quranTheme].markerColor,
                }}
              />
            ))}
          </Pressable>
        </GestureDetector>
      </View>

      <PageNumber page={page} quranTheme={quranTheme} />
    </YStack>
  );
};

export default QuranPage;
