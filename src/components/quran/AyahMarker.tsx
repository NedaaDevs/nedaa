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

const toHafsDigits = (n: number): string =>
  String(n)
    .split("")
    .reverse()
    .map((d) => String.fromCharCode(0xfd50 + +d))
    .join("");

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
          fontFamily: "UthmanicHafs",
          textAlign: "center",
          includeFontPadding: false,
        }}>
        {toHafsDigits(ayahNumber)}
      </Text>
    </View>
  );
};

export default AyahMarker;
