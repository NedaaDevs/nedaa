import { useEffect, useMemo, useState } from "react";
import { Image, View } from "react-native";
import { Paths } from "expo-file-system";

import { DownloadStatus, MushafImageType, MushafVersion, QuranThemeType } from "@/enums/quran";
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
import { ayahImageRows, widestAyahWord } from "@/utils/ayahImageRows";

interface AyahImageProps {
  version: MushafVersion;
  page: number;
  surah: number;
  ayah: number;
  quranTheme: QuranThemeType;
  maxWidth: number;
  // Shown until the crop is ready, or if it can't be produced (keeps tajweed
  // colour for image editions, falls back to text otherwise).
  fallback: React.ReactNode;
}

const pad3 = (n: number) => String(n).padStart(3, "0");
// A short ayah's line height; a word wider than the card scales down.
const TARGET_LINE_HEIGHT = 46;
const ROW_GAP = 4;
export const AYAH_IMAGE_ROW = "ayah-image-row";

// An ayah in the edition's own ink, its words cut from the line or page images
// by glyph bounds and flowed as one run across the card.
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

  const srcLineHeight =
    isPageMode && sourceHeight > 0 ? sourceHeight / LINES_PER_PAGE : IMAGE_SOURCE_LINE_HEIGHT;

  // Words wider than the card shrink to fit it; others keep the target height.
  const widestWord = useMemo(() => widestAyahWord(bounds, surah, ayah), [bounds, surah, ayah]);
  const scale = Math.min(maxWidth / widestWord, TARGET_LINE_HEIGHT / srcLineHeight);
  const rows = useMemo(
    () => ayahImageRows(bounds, surah, ayah, maxWidth / scale),
    [bounds, surah, ayah, maxWidth, scale]
  );

  // Glyphs or the page's size still loading, or no glyphs for the ayah here.
  if (rows.length === 0 || (isPageMode && sourceHeight === 0)) {
    return <>{fallback}</>;
  }

  const imgWidth = IMAGE_SOURCE_WIDTH * scale;
  const rowHeight = srcLineHeight * scale;

  return (
    <View style={{ alignItems: "center", gap: ROW_GAP }}>
      {rows.map((row, i) => (
        // A row reads from the right in every app direction.
        <View
          key={i}
          testID={AYAH_IMAGE_ROW}
          style={{ flexDirection: "row-reverse", direction: "ltr" }}>
          {row.map((run) => (
            <View
              key={`${run.line}:${run.x}`}
              // The offset counts from the image's left edge in every direction.
              style={{
                width: run.width * scale,
                height: rowHeight,
                overflow: "hidden",
                direction: "ltr",
              }}>
              <Image
                source={{
                  uri: isPageMode
                    ? `${Paths.document.uri}quran/${dirSegment}/pages/${pad3(page)}.png`
                    : `${Paths.document.uri}quran/${dirSegment}/lines/${pad3(page)}/${pad3(run.line)}.png`,
                }}
                fadeDuration={0}
                tintColor={tintColor}
                style={{
                  position: "absolute",
                  width: imgWidth,
                  height: isPageMode ? sourceHeight * scale : rowHeight,
                  left: -run.x * scale,
                  top: isPageMode ? -(run.line - 1) * rowHeight : 0,
                }}
              />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
};

export default AyahImage;
