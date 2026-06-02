import { useCallback, useMemo, useRef, useState } from "react";
import { LayoutChangeEvent, Pressable, Text, View, useWindowDimensions } from "react-native";
import { YStack } from "tamagui";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MushafVersion, QuranTheme } from "@/enums/quran";
import {
  LINES_PER_PAGE,
  QURAN_THEME_COLORS,
  IMAGE_SOURCE_WIDTH,
  IMAGE_SOURCE_LINE_HEIGHT,
  SURAH_NAMES,
} from "@/constants/Quran";
import { usePageData } from "@/hooks/usePageData";
import { useAyahHitTest } from "@/hooks/useAyahHitTest";
import LineImage from "@/components/quran/LineImage";
import PageImage from "@/components/quran/PageImage";
import LineShimmer from "@/components/quran/LineShimmer";
import PageHeader from "@/components/quran/PageHeader";
import PageNumber from "@/components/quran/PageNumber";
import AyahMarker from "@/components/quran/AyahMarker";

const LONG_PRESS_MS = 400;

interface QuranPageProps {
  page: number;
  version: MushafVersion;
  quranTheme: QuranTheme;
}

// Constant 1..15 line numbers — hoisted so it isn't reallocated every render.
const PAGE_LINE_NUMBERS = Array.from({ length: LINES_PER_PAGE }, (_, i) => i + 1);

const QuranPage = ({ page, version, quranTheme }: QuranPageProps) => {
  const { width, height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const estimatedHeight = screenHeight - insets.top - 60;
  const [linesAreaHeight, setLinesAreaHeight] = useState(estimatedHeight);
  const pressableRef = useRef<View>(null);

  const { pageAvailable, isPageMode, surahNames, juz, glyphBounds, sourcePageHeight } = usePageData(
    version,
    page
  );

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

  const { highlightedAyah, handlePress, handleLongPress } = useAyahHitTest({
    version,
    page,
    glyphBounds,
    geometry,
    pressableRef,
  });

  // Header surah is derived from the page's own glyphs (each carries its
  // surahNumber), so continuation pages show the running surah — and it's
  // naturally blank while the page is still downloading (no glyphs yet).
  const headerSurah = useMemo(() => {
    if (!pageAvailable || glyphBounds.length === 0) return "";
    const topSurah = glyphBounds.reduce((min, g) => Math.min(min, g.surahNumber), Infinity);
    return SURAH_NAMES[topSurah] ?? "";
  }, [pageAvailable, glyphBounds]);

  const highlightRects = useMemo(() => {
    if (!highlightedAyah || lineHeight === 0) return [];

    const ayahGlyphs = glyphBounds.filter(
      (g) => g.surahNumber === highlightedAyah.surah && g.ayahNumber === highlightedAyah.ayah
    );

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
      // Convert source coords to screen coords for page mode
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
  }, [
    highlightedAyah,
    lineHeight,
    glyphBounds,
    isPageMode,
    pageScaleX,
    pageScaleY,
    srcLineHeight,
    coverScale,
  ]);

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
          ayahNumber: g.ayahNumber,
        };
      }
      return {
        x: g.x * coverScale,
        y: (g.line - 1) * lineHeight + g.y * coverScale - lineCoverClipY,
        width: g.width * coverScale,
        height: g.height * coverScale,
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

  return (
    <YStack
      flex={1}
      width={width}
      style={{ backgroundColor: QURAN_THEME_COLORS[quranTheme].background }}>
      <PageHeader surahName={headerSurah} juz={pageAvailable ? juz : null} quranTheme={quranTheme} />

      <View
        style={{
          flex: 1,
          alignItems: "center",
          backgroundColor: QURAN_THEME_COLORS[quranTheme].innerBackground,
        }}
        onLayout={onLinesLayout}>
        <Pressable
          ref={pressableRef}
          style={{ position: "relative", direction: "ltr" }}
          onLongPress={handleLongPress}
          delayLongPress={LONG_PRESS_MS}
          onPress={handlePress}>
          {lineHeight > 0 && pageAvailable && isPageMode && (
            <PageImage
              version={version}
              page={page}
              screenWidth={width}
              availableHeight={linesAreaHeight}
              quranTheme={quranTheme}
            />
          )}
          {lineHeight > 0 && !pageAvailable && isPageMode && (
            <LineShimmer screenWidth={width} lineHeight={linesAreaHeight} quranTheme={quranTheme} />
          )}
          {lineHeight > 0 &&
            !isPageMode &&
            PAGE_LINE_NUMBERS.map((line) =>
              pageAvailable ? (
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

          {pageAvailable &&
            markerPositions.map((m, i) => (
              <AyahMarker
                key={`marker-${i}`}
                x={m.x}
                y={m.y}
                width={m.width}
                height={m.height}
                ayahNumber={m.ayahNumber}
                version={version}
                quranTheme={quranTheme}
              />
            ))}

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

          {/* Ayah tooltip */}
          {highlightedAyah && (
            <View
              style={{
                position: "absolute",
                left: Math.min(Math.max(highlightedAyah.touchX - 60, 8), width - 128),
                top: highlightedAyah.touchY - 44,
                backgroundColor: QURAN_THEME_COLORS[quranTheme].headerColor,
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 8,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.2,
                shadowRadius: 4,
                elevation: 4,
              }}>
              <Text
                style={{
                  color: QURAN_THEME_COLORS[quranTheme].innerBackground,
                  fontSize: 13,
                  fontWeight: "600",
                  textAlign: "center",
                }}>
                {surahNames[highlightedAyah.surah] ?? `${highlightedAyah.surah}`}
                {" : "}
                {highlightedAyah.ayah}
              </Text>
            </View>
          )}
        </Pressable>
      </View>

      <PageNumber page={page} quranTheme={quranTheme} />
    </YStack>
  );
};

export default QuranPage;
