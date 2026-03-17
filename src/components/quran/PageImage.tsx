import { useMemo } from "react";
import { Image, ImageStyle, View } from "react-native";
import { Paths } from "expo-file-system";
import { ColorMatrix } from "react-native-color-matrix-image-filters";

import { MushafVersion, QuranTheme } from "@/enums/quran";
import { QURAN_THEME_COLORS } from "@/constants/Quran";

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

const getColorMatrixValues = (hexColor: string): number[] => {
  const r = parseInt(hexColor.slice(1, 3), 16) / 255;
  const g = parseInt(hexColor.slice(3, 5), 16) / 255;
  const b = parseInt(hexColor.slice(5, 7), 16) / 255;
  return [0, 0, 0, r, 0, 0, 0, 0, g, 0, 0, 0, 0, b, 0, 0, 0, 0, 1, 0];
};

const PageImage = ({ version, page, screenWidth, availableHeight, quranTheme }: PageImageProps) => {
  const uri = getPageImageUri(version, page);
  const themeColors = QURAN_THEME_COLORS[quranTheme];

  const containerStyle = useMemo(
    () => ({ width: screenWidth, height: availableHeight, overflow: "hidden" as const }),
    [screenWidth, availableHeight]
  );

  const imageStyle: ImageStyle = useMemo(
    () => ({ width: screenWidth, height: availableHeight }),
    [screenWidth, availableHeight]
  );

  const image = <Image source={{ uri }} style={imageStyle} resizeMode="cover" fadeDuration={0} />;

  if (!themeColors.textTint) {
    return <View style={containerStyle}>{image}</View>;
  }

  return (
    <View style={containerStyle}>
      <ColorMatrix matrix={getColorMatrixValues(themeColors.textTint)}>{image}</ColorMatrix>
    </View>
  );
};

export default PageImage;
