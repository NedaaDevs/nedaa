import { useMemo } from "react";
import { Image, ImageStyle, View } from "react-native";
import { Paths } from "expo-file-system";
import { Canvas, Image as SkiaImage, Rect, Group, useImage } from "@shopify/react-native-skia";

import { MushafVersion, QuranTheme } from "@/enums/quran";
import { QURAN_THEME_COLORS } from "@/constants/Quran";
import { useQuranStore } from "@/stores/quran";

interface LineImageProps {
  version: MushafVersion;
  page: number;
  line: number;
  screenWidth: number;
  lineHeight: number;
  quranTheme: QuranTheme;
}

const getLineImageUri = (version: MushafVersion, page: number, line: number): string => {
  const pageStr = String(page).padStart(3, "0");
  const lineStr = String(line).padStart(3, "0");
  return `${Paths.document.uri}quran/${version}/lines/${pageStr}/${lineStr}.png`;
};

const LineImage = ({
  version,
  page,
  line,
  screenWidth,
  lineHeight,
  quranTheme,
}: LineImageProps) => {
  const uri = getLineImageUri(version, page, line);
  const themeColors = QURAN_THEME_COLORS[quranTheme];
  const colorMatrixEnabled = useQuranStore((s) => s.colorMatrixEnabled);
  const renderMode = useQuranStore((s) => s.renderMode);

  const tintColor = colorMatrixEnabled ? themeColors.textTint : undefined;

  const containerStyle = useMemo(
    () => ({ width: screenWidth, height: lineHeight, overflow: "hidden" as const }),
    [screenWidth, lineHeight]
  );

  const imageStyle: ImageStyle = useMemo(
    () => ({
      width: screenWidth,
      height: lineHeight,
      tintColor,
    }),
    [screenWidth, lineHeight, tintColor]
  );

  // Skia mode: multiply blend
  if (renderMode === "skia" && colorMatrixEnabled) {
    return (
      <SkiaLineImage
        uri={uri}
        width={screenWidth}
        height={lineHeight}
        backgroundColor={themeColors.innerBackground}
      />
    );
  }

  // tintColor mode (default)
  return (
    <View style={containerStyle}>
      <Image source={{ uri }} style={imageStyle} resizeMode="cover" fadeDuration={0} />
    </View>
  );
};

const SkiaLineImage = ({
  uri,
  width,
  height,
  backgroundColor,
}: {
  uri: string;
  width: number;
  height: number;
  backgroundColor: string;
}) => {
  const image = useImage(uri);

  if (!image) return <View style={{ width, height }} />;

  return (
    <Canvas style={{ width, height }}>
      <Rect x={0} y={0} width={width} height={height} color={backgroundColor} />
      <Group blendMode="multiply">
        <SkiaImage image={image} x={0} y={0} width={width} height={height} fit="cover" />
      </Group>
    </Canvas>
  );
};

export default LineImage;
