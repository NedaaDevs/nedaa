import { useEffect, useMemo, useState } from "react";
import { Image, View } from "react-native";
import { Paths } from "expo-file-system";

import { DownloadStatus, MushafImageType, MushafVersion, QuranTheme } from "@/enums/quran";
import {
  IMAGE_SOURCE_WIDTH,
  IMAGE_SOURCE_LINE_HEIGHT,
  LINES_PER_PAGE,
  QURAN_THEME_COLORS,
  isColoredVersion,
  quranImageDirSegment,
} from "@/constants/Quran";
import { useQuranStore } from "@/stores/quran";
import { QuranContentDB } from "@/services/quran-content-db";
import { QuranDownload } from "@/services/quran-download";
import type { GlyphBound } from "@/types/quran";

interface AyahImageProps {
  version: MushafVersion;
  page: number;
  surah: number;
  ayah: number;
  quranTheme: QuranTheme;
  maxWidth: number;
  // Shown until the crop is ready, or if it can't be produced (keeps tajweed
  // colour for image editions, falls back to text otherwise).
  fallback: React.ReactNode;
}

const pad3 = (n: number) => String(n).padStart(3, "0");
// Cap so a one-word ayah doesn't blow up; long ayahs scale down to fit width.
const TARGET_LINE_HEIGHT = 46;

// Renders an ayah as it appears in the actual edition — each line cropped from
// the edition's line/page images via glyph bounds — so a colour edition (V4
// tajweed) keeps its ink in the action sheet instead of monochrome DB text.
const AyahImage = ({
  version,
  page,
  surah,
  ayah,
  quranTheme,
  maxWidth,
  fallback,
}: AyahImageProps) => {
  const darkAvailable = useQuranStore(
    (s) => s.versionDownloads[version]?.dark?.status === DownloadStatus.COMPLETE
  );
  const [bounds, setBounds] = useState<GlyphBound[]>([]);
  const [sourceHeight, setSourceHeight] = useState(0);

  const isPageMode = QuranDownload.getImageType(version) === MushafImageType.PAGE;
  const dirSegment = quranImageDirSegment(version, quranTheme, darkAvailable);
  const tintColor = isColoredVersion(version) ? undefined : QURAN_THEME_COLORS[quranTheme].textTint;

  useEffect(() => {
    let active = true;
    QuranContentDB.getGlyphBounds(version, page).then((b) => {
      if (active) setBounds(b);
    });
    return () => {
      active = false;
    };
  }, [version, page]);

  useEffect(() => {
    if (!isPageMode) return;
    const uri = `${Paths.document.uri}quran/${dirSegment}/pages/${pad3(page)}.png`;
    Image.getSize(
      uri,
      (_w, h) => setSourceHeight(h),
      () => setSourceHeight(0)
    );
  }, [isPageMode, dirSegment, page]);

  // One {line, minX, maxX} segment per line the ayah occupies.
  const segments = useMemo(() => {
    const lineMap = new Map<number, { minX: number; maxX: number }>();
    for (const g of bounds) {
      if (g.surahNumber !== surah || g.ayahNumber !== ayah) continue;
      const existing = lineMap.get(g.line);
      const right = g.x + g.width;
      if (existing) {
        existing.minX = Math.min(existing.minX, g.x);
        existing.maxX = Math.max(existing.maxX, right);
      } else {
        lineMap.set(g.line, { minX: g.x, maxX: right });
      }
    }
    return [...lineMap.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([line, { minX, maxX }]) => ({ line, minX, maxX }));
  }, [bounds, surah, ayah]);

  const srcLineHeight =
    isPageMode && sourceHeight > 0 ? sourceHeight / LINES_PER_PAGE : IMAGE_SOURCE_LINE_HEIGHT;

  // Not ready (glyphs still loading, or page dims pending in page mode) or the
  // ayah has no glyphs here → show the text fallback.
  if (segments.length === 0 || (isPageMode && sourceHeight === 0)) {
    return <>{fallback}</>;
  }

  const widest = Math.max(...segments.map((s) => s.maxX - s.minX));
  const scale = Math.min(maxWidth / widest, TARGET_LINE_HEIGHT / srcLineHeight);
  const imgWidth = IMAGE_SOURCE_WIDTH * scale;

  return (
    <View style={{ alignItems: "center", gap: 4 }}>
      {segments.map((s) => {
        const segWidth = (s.maxX - s.minX) * scale;
        const segHeight = srcLineHeight * scale;
        return (
          <View key={s.line} style={{ width: segWidth, height: segHeight, overflow: "hidden" }}>
            <Image
              source={{
                uri: isPageMode
                  ? `${Paths.document.uri}quran/${dirSegment}/pages/${pad3(page)}.png`
                  : `${Paths.document.uri}quran/${dirSegment}/lines/${pad3(page)}/${pad3(s.line)}.png`,
              }}
              fadeDuration={0}
              tintColor={tintColor}
              style={{
                position: "absolute",
                width: imgWidth,
                height: isPageMode ? sourceHeight * scale : segHeight,
                left: -s.minX * scale,
                top: isPageMode ? -(s.line - 1) * srcLineHeight * scale : 0,
              }}
            />
          </View>
        );
      })}
    </View>
  );
};

export default AyahImage;
