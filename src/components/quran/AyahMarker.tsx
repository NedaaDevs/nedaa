import { useMemo } from "react";
import { Image, Text, View } from "react-native";
import { Paths } from "expo-file-system";

import { MushafVersion, QuranTheme } from "@/enums/quran";
import { QURAN_THEME_COLORS, QURAN_MARKER_FRAME, MARKER_ADJUSTMENTS } from "@/constants/Quran";

interface AyahMarkerProps {
  x: number;
  y: number;
  width: number;
  height: number;
  ayahNumber: number;
  version: MushafVersion;
  quranTheme: QuranTheme;
}

const toArabicIndic = (n: number): string =>
  String(n).replace(
    /\d/g,
    (d) => "\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669"[+d]
  );

const AyahMarker = ({ x, y, width, height, ayahNumber, version, quranTheme }: AyahMarkerProps) => {
  const themeColors = QURAN_THEME_COLORS[quranTheme];
  const adjustments = MARKER_ADJUSTMENTS[version];
  const frameFile = QURAN_MARKER_FRAME[quranTheme];

  const markerWidth = width * adjustments.scaleMultiplier;
  const markerHeight = height * adjustments.scaleMultiplier;
  const markerX = x + adjustments.offsetX + (width - markerWidth) / 2;
  const markerY = y + adjustments.offsetY + (height - markerHeight) / 2;
  const fontSize = markerHeight * adjustments.fontSizeMultiplier;

  const frameUri = `${Paths.document.uri}quran/${version}/markers/${frameFile}`;

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
        source={{ uri: frameUri }}
        style={{ position: "absolute", width: markerWidth, height: markerHeight }}
        resizeMode="contain"
        fadeDuration={0}
      />
      <Text
        style={{
          fontSize,
          color: themeColors.markerColor,
          fontFamily: "IBMPlexSansArabic",
          textAlign: "center",
          includeFontPadding: false,
        }}>
        {toArabicIndic(ayahNumber)}
      </Text>
    </View>
  );
};

export default AyahMarker;
