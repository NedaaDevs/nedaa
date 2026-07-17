import { useMemo } from "react";
import { Image, Text, View } from "react-native";

import RibbonGlyph from "@/components/quran/RibbonGlyph";
import { MushafVersion, OrnamentAsset, OrnamentCategory, QuranThemeType } from "@/enums/quran";
import {
  BUNDLED_ORNAMENT_META,
  MARKER_ADJUSTMENTS,
  NEDAA_STYLE_ID,
  ORNAMENT_INKS,
  QURAN_FONT_FAMILY,
  toHafsDigits,
} from "@/constants/Quran";
import { useQuranStore } from "@/stores/quran";
import { medallionBox, ornamentThemeSlot, resolveOrnamentImage } from "@/utils/quranOrnaments";

interface AyahMarkerProps {
  x: number;
  y: number;
  width: number;
  height: number;
  ayahNumber: number;
  version: MushafVersion;
  quranTheme: QuranThemeType;
  // When set, the ayah is bookmarked: the medallion frame tints to this colour;
  // the number keeps its normal style.
  bookmarkColor?: string;
}

const AyahMarker = ({
  x,
  y,
  width,
  height,
  ayahNumber,
  version,
  quranTheme,
  bookmarkColor,
}: AyahMarkerProps) => {
  const adjustments = MARKER_ADJUSTMENTS[version];
  const markerStyle =
    useQuranStore((s) => s.ornamentStyle[OrnamentCategory.AYAH_MARKER]) ?? NEDAA_STYLE_ID;
  const markerMeta =
    useQuranStore((s) => s.ornamentMeta[OrnamentCategory.AYAH_MARKER]) ??
    BUNDLED_ORNAMENT_META[OrnamentCategory.AYAH_MARKER];
  const aspect = markerMeta.assets[OrnamentAsset.MARKER]?.aspect ?? 0.75;

  // Height-based box at the art's native aspect, centered on the squarish glyph slot.
  const { width: markerWidth, height: markerHeight } = medallionBox(
    width,
    height,
    aspect,
    adjustments.scaleMultiplier
  );
  const markerX = x + adjustments.offsetX + (width - markerWidth) / 2;
  const markerY = y + adjustments.offsetY + (height - markerHeight) / 2;
  // Three-digit ayah numbers (100–286) shrink so they fit the slot the way one-
  // and two-digit numbers do.
  const fontSize = markerHeight * adjustments.fontSizeMultiplier * (ayahNumber >= 100 ? 0.72 : 1);
  // The number matches the medallion's pre-tinted ink, not the theme token.
  const inkColor = ORNAMENT_INKS[ornamentThemeSlot(quranTheme)];

  const source = useMemo(
    () =>
      resolveOrnamentImage(
        OrnamentCategory.AYAH_MARKER,
        OrnamentAsset.MARKER,
        quranTheme,
        version,
        markerStyle
      ),
    [quranTheme, version, markerStyle]
  );

  const containerStyle = useMemo(
    () => ({
      position: "absolute" as const,
      left: markerX,
      top: markerY,
      width: markerWidth,
      height: markerHeight,
      justifyContent: "center" as const,
      alignItems: "center" as const,
    }),
    [markerX, markerY, markerWidth, markerHeight]
  );

  return (
    <View
      style={containerStyle}
      accessibilityRole="button"
      accessibilityLabel={`Ayah ${ayahNumber}`}>
      <Image
        source={source}
        style={{
          position: "absolute",
          width: markerWidth,
          height: markerHeight,
          // The ONLY runtime tint: a bookmark colours the whole medallion.
          tintColor: bookmarkColor,
        }}
        resizeMode="contain"
        fadeDuration={0}
      />
      {bookmarkColor ? (
        // Bookmarked: a ribbon in the bookmark colour takes the number's place,
        // sized to sit inside the medallion.
        <RibbonGlyph size={markerHeight * 0.6} color={bookmarkColor} />
      ) : (
        <Text
          style={{
            fontSize,
            color: inkColor,
            fontFamily: QURAN_FONT_FAMILY,
            textAlign: "center",
            includeFontPadding: false,
          }}>
          {toHafsDigits(ayahNumber)}
        </Text>
      )}
    </View>
  );
};

export default AyahMarker;
