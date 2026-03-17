import { useCallback, useEffect, useRef, useState } from "react";
import {
  LayoutChangeEvent,
  Platform,
  Pressable,
  StatusBar,
  View,
  useWindowDimensions,
} from "react-native";
import type { GestureResponderEvent } from "react-native";
import { YStack } from "tamagui";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MushafVersion, MushafImageType, QuranTheme, LineType } from "@/enums/quran";
import {
  LINES_PER_PAGE,
  QURAN_THEME_COLORS,
  IMAGE_SOURCE_WIDTH,
  IMAGE_SOURCE_LINE_HEIGHT,
} from "@/constants/Quran";
import { GlyphBound } from "@/types/quran";
import { QuranDB } from "@/services/quran-db";
import { QuranDownload } from "@/services/quran-download";
import LineImage from "@/components/quran/LineImage";
import PageImage from "@/components/quran/PageImage";
import LineShimmer from "@/components/quran/LineShimmer";
import PageHeader from "@/components/quran/PageHeader";
import PageNumber from "@/components/quran/PageNumber";

const LONG_PRESS_MS = 400;
const IMAGE_SOURCE_PAGE_HEIGHT = IMAGE_SOURCE_LINE_HEIGHT * LINES_PER_PAGE;

interface QuranPageProps {
  page: number;
  version: MushafVersion;
  quranTheme: QuranTheme;
}

const QuranPage = ({ page, version, quranTheme }: QuranPageProps) => {
  const { width, height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const estimatedHeight = screenHeight - insets.top - 60;
  const [surahName, setSurahName] = useState("");
  const [juz, setJuz] = useState(1);
  const [linesAreaHeight, setLinesAreaHeight] = useState(estimatedHeight);
  const [glyphBounds, setGlyphBounds] = useState<GlyphBound[]>([]);
  const [highlightedAyah, setHighlightedAyah] = useState<{
    surah: number;
    ayah: number;
  } | null>(null);
  const [pageAvailable, setPageAvailable] = useState(() =>
    QuranDownload.isPageAvailable(version, page)
  );
  const isPageMode = QuranDownload.getImageType(version) === MushafImageType.PAGE;
  const linesRef = useRef<View>(null);
  const pressableRef = useRef<View>(null);

  useEffect(() => {
    const available = QuranDownload.isPageAvailable(version, page);
    setPageAvailable(available);
    if (!available) {
      QuranDownload.prioritizePage(page);
    }
    setHighlightedAyah(null);
  }, [page, version]);

  useEffect(() => {
    if (!pageAvailable) return;

    const loadPageData = async () => {
      try {
        const [lineMetadata, juzNumber, bounds] = await Promise.all([
          QuranDB.getLineMetadata(version, page),
          QuranDB.getJuzForPage(page),
          QuranDB.getGlyphBounds(version, page),
        ]);

        const surahHeader = lineMetadata.find(
          (lm) => lm.type === LineType.SURAH_HEADER && lm.surahName
        );
        if (surahHeader?.surahName) {
          setSurahName(surahHeader.surahName);
        }
        setJuz(juzNumber);
        setGlyphBounds(bounds);
      } catch (error) {
        console.warn(`[QuranPage] Failed to load data for page ${page}:`, error);
      }
    };

    loadPageData();
  }, [page, version, pageAvailable]);

  useEffect(() => {
    if (pageAvailable !== false) return;

    const interval = setInterval(() => {
      if (QuranDownload.isPageAvailable(version, page)) {
        setPageAvailable(true);
        clearInterval(interval);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [pageAvailable, version, page]);

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

  // For PAGE mode: the full page image uses cover mode
  // cover picks the larger scale to fill both dimensions
  const pageScaleByWidth = width / IMAGE_SOURCE_WIDTH;
  const pageScaleByHeight = linesAreaHeight / IMAGE_SOURCE_PAGE_HEIGHT;
  const pageCoverScale = Math.max(pageScaleByWidth, pageScaleByHeight);
  const pageRenderedHeight = IMAGE_SOURCE_PAGE_HEIGHT * pageCoverScale;
  const pageRenderedWidth = IMAGE_SOURCE_WIDTH * pageCoverScale;
  const pageClipY = (pageRenderedHeight - linesAreaHeight) / 2;
  const pageClipX = (pageRenderedWidth - width) / 2;

  const handleLongPress = useCallback(
    (event: GestureResponderEvent) => {
      if (glyphBounds.length === 0 || lineHeight === 0) return;

      pressableRef.current?.measureInWindow((px, py) => {
        const statusBarOffset = Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) : 0;
        const touchX = event.nativeEvent.pageX - px;
        const touchY = event.nativeEvent.pageY - py - statusBarOffset;

        let sourceX: number;
        let sourceLine: number;
        let sourceY: number;

        if (isPageMode) {
          // Convert screen coords to source image coords accounting for cover offset
          const srcX = (touchX + pageClipX) / pageCoverScale;
          const srcY = (touchY + pageClipY) / pageCoverScale;
          sourceLine = Math.floor(srcY / IMAGE_SOURCE_LINE_HEIGHT) + 1;
          sourceX = srcX;
          sourceY = srcY - (sourceLine - 1) * IMAGE_SOURCE_LINE_HEIGHT;
        } else {
          sourceX = touchX / coverScale;
          sourceLine = Math.floor(touchY / lineHeight) + 1;
          sourceY = (touchY - (sourceLine - 1) * lineHeight + lineCoverClipY) / coverScale;
        }

        const hit = glyphBounds.find(
          (g) =>
            g.line === sourceLine &&
            sourceX >= g.x &&
            sourceX <= g.x + g.width &&
            sourceY >= g.y &&
            sourceY <= g.y + g.height &&
            !g.isMarker
        );

        if (hit) {
          setHighlightedAyah({ surah: hit.surahNumber, ayah: hit.ayahNumber });
        } else {
          setHighlightedAyah(null);
        }
      });
    },
    [
      glyphBounds,
      lineHeight,
      coverScale,
      lineCoverClipY,
      isPageMode,
      pageCoverScale,
      pageClipX,
      pageClipY,
    ]
  );

  const lines = Array.from({ length: LINES_PER_PAGE }, (_, i) => i + 1);

  const highlightRects = (() => {
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
        left: minX * pageCoverScale - pageClipX,
        top: (line - 1) * IMAGE_SOURCE_LINE_HEIGHT * pageCoverScale - pageClipY,
        width: (maxX - minX) * pageCoverScale,
        height: IMAGE_SOURCE_LINE_HEIGHT * pageCoverScale,
      }));
    }

    return Array.from(lineMap.entries()).map(([line, { minX, maxX }]) => ({
      left: minX * coverScale,
      top: (line - 1) * lineHeight,
      width: (maxX - minX) * coverScale,
      height: lineHeight,
    }));
  })();

  return (
    <YStack
      flex={1}
      width={width}
      style={{ backgroundColor: QURAN_THEME_COLORS[quranTheme].background }}>
      <PageHeader surahName={surahName} juz={juz} quranTheme={quranTheme} />

      <View
        ref={linesRef}
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
          onPress={() => setHighlightedAyah(null)}>
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
            lines.map((line) =>
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
        </Pressable>
      </View>

      <PageNumber page={page} quranTheme={quranTheme} />
    </YStack>
  );
};

export default QuranPage;
