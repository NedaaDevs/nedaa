import { useEffect, useMemo, useState } from "react";
import { Image, ImageStyle, View } from "react-native";
import { Paths } from "expo-file-system";
import {
  Canvas,
  Image as SkiaImage,
  Rect,
  Group,
  Mask,
  useImage,
} from "@shopify/react-native-skia";

import { MushafVersion, QuranTheme } from "@/enums/quran";
import { QURAN_THEME_COLORS, IMAGE_SOURCE_WIDTH } from "@/constants/Quran";
import { useQuranStore } from "@/stores/quran";

interface PageImageProps {
  version: MushafVersion;
  page: number;
  screenWidth: number;
  availableHeight: number;
  quranTheme: QuranTheme;
}

const getPageImageUri = (version: MushafVersion, page: number): string => {
  const pageStr = String(page).padStart(3, "0");
  return `${Paths.document.uri}quran/${version}/pages/${pageStr}.png`;
};

const PageImage = ({ version, page, screenWidth, availableHeight, quranTheme }: PageImageProps) => {
  const uri = getPageImageUri(version, page);
  const themeColors = QURAN_THEME_COLORS[quranTheme];
  const colorMatrixEnabled = useQuranStore((s) => s.colorMatrixEnabled);
  const renderMode = useQuranStore((s) => s.renderMode);
  const [sourceHeight, setSourceHeight] = useState(0);

  useEffect(() => {
    Image.getSize(uri, (_w, h) => setSourceHeight(h));
  }, [uri]);

  const scale = screenWidth / IMAGE_SOURCE_WIDTH;
  const scaledPageHeight = sourceHeight > 0 ? Math.round(sourceHeight * scale) : availableHeight;
  const scaleY = scaledPageHeight > 0 ? availableHeight / scaledPageHeight : 1;

  const tintColor = colorMatrixEnabled ? themeColors.textTint : undefined;

  const containerStyle = useMemo(
    () => ({ width: screenWidth, height: availableHeight }),
    [screenWidth, availableHeight]
  );

  if (sourceHeight === 0) return <View style={containerStyle} />;

  // Skia mode: alpha mask tinting
  if (renderMode === "skia" && colorMatrixEnabled && themeColors.textTint) {
    return (
      <SkiaPageImage
        uri={uri}
        width={screenWidth}
        height={availableHeight}
        scaledHeight={scaledPageHeight}
        scaleY={scaleY}
        textColor={themeColors.textTint}
      />
    );
  }

  // tintColor mode (default)
  const imageStyle: ImageStyle = {
    width: screenWidth,
    height: scaledPageHeight,
    transform: [{ scaleY }],
    transformOrigin: "top",
    tintColor,
  };

  return (
    <View style={containerStyle}>
      <Image source={{ uri }} style={imageStyle} fadeDuration={0} />
    </View>
  );
};

const SkiaPageImage = ({
  uri,
  width,
  height,
  scaledHeight,
  scaleY,
  textColor,
}: {
  uri: string;
  width: number;
  height: number;
  scaledHeight: number;
  scaleY: number;
  textColor: string;
}) => {
  const image = useImage(uri);

  if (!image) return <View style={{ width, height }} />;

  return (
    <Canvas style={{ width, height }}>
      <Group transform={[{ scaleY }]} origin={{ x: 0, y: 0 }}>
        <Mask
          mode="alpha"
          mask={
            <SkiaImage image={image} x={0} y={0} width={width} height={scaledHeight} fit="fill" />
          }>
          <Rect x={0} y={0} width={width} height={scaledHeight} color={textColor} />
        </Mask>
      </Group>
    </Canvas>
  );
};

export default PageImage;
