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

import { MushafVersion, QuranTheme, LineType } from "@/enums/quran";
import {
  LINES_PER_PAGE,
  QURAN_THEME_COLORS,
  IMAGE_SOURCE_WIDTH,
  IMAGE_SOURCE_LINE_HEIGHT,
} from "@/constants/Quran";
import { GlyphBound } from "@/types/quran";
import { QuranDB } from "@/services/quran-db";
import LineImage from "@/components/quran/LineImage";
import PageHeader from "@/components/quran/PageHeader";
import PageNumber from "@/components/quran/PageNumber";

const LONG_PRESS_MS = 400;

interface QuranPageProps {
  page: number;
  version: MushafVersion;
  quranTheme: QuranTheme;
}

const QuranPage = ({ page, version, quranTheme }: QuranPageProps) => {
  const { width } = useWindowDimensions();
  const [surahName, setSurahName] = useState("");
  const [juz, setJuz] = useState(1);
  const [linesAreaHeight, setLinesAreaHeight] = useState(0);
  const [glyphBounds, setGlyphBounds] = useState<GlyphBound[]>([]);
  const [highlightedAyah, setHighlightedAyah] = useState<{ surah: number; ayah: number } | null>(
    null
  );
  const linesRef = useRef<View>(null);
  const pressableRef = useRef<View>(null);

  useEffect(() => {
    const loadPageData = async () => {
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
    };

    loadPageData();
    setHighlightedAyah(null);
  }, [page, version]);

  const onLinesLayout = useCallback((event: LayoutChangeEvent) => {
    setLinesAreaHeight(event.nativeEvent.layout.height);
  }, []);

  const lineHeight = linesAreaHeight > 0 ? Math.floor(linesAreaHeight / LINES_PER_PAGE) : 0;
  // Cover mode scales image by xScale to fill width — same scale for both axes
  const coverScale = width / IMAGE_SOURCE_WIDTH;
  const scaledLineHeight = IMAGE_SOURCE_LINE_HEIGHT * coverScale;
  // Cover clips excess height equally from top and bottom
  const coverClipY = (scaledLineHeight - lineHeight) / 2;

  const handleLongPress = useCallback(
    (event: GestureResponderEvent) => {
      if (glyphBounds.length === 0 || lineHeight === 0) return;

      // Use locationX/Y relative to the Pressable itself
      pressableRef.current?.measureInWindow((px, py) => {
        // Android pageY includes status bar but measureInWindow doesn't
        const statusBarOffset = Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) : 0;
        const touchX = event.nativeEvent.pageX - px;
        const touchY = event.nativeEvent.pageY - py - statusBarOffset;

        const sourceX = touchX / coverScale;
        const sourceLine = Math.floor(touchY / lineHeight) + 1;
        const sourceY = (touchY - (sourceLine - 1) * lineHeight + coverClipY) / coverScale;

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
          console.log(`[Quran] Ayah ${hit.surahNumber}:${hit.ayahNumber} | Page ${page}`);
        } else {
          setHighlightedAyah(null);
        }
      });
    },
    [glyphBounds, lineHeight, coverScale, coverClipY, page]
  );

  const lines = Array.from({ length: LINES_PER_PAGE }, (_, i) => i + 1);

  const highlightRects = (() => {
    if (!highlightedAyah || lineHeight === 0) return [];

    const ayahGlyphs = glyphBounds.filter(
      (g) => g.surahNumber === highlightedAyah.surah && g.ayahNumber === highlightedAyah.ayah
    );

    // Group by line, get bounding box per line
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

      <View ref={linesRef} style={{ flex: 1, alignItems: "center" }} onLayout={onLinesLayout}>
        <Pressable
          ref={pressableRef}
          style={{ position: "relative", direction: "ltr" }}
          onLongPress={handleLongPress}
          delayLongPress={LONG_PRESS_MS}
          onPress={() => setHighlightedAyah(null)}>
          {lineHeight > 0 &&
            lines.map((line) => (
              <LineImage
                key={`${page}-${line}`}
                version={version}
                page={page}
                line={line}
                screenWidth={width}
                lineHeight={lineHeight}
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
        </Pressable>
      </View>

      <PageNumber page={page} quranTheme={quranTheme} />
    </YStack>
  );
};

export default QuranPage;
