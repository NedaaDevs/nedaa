import { useMemo } from "react";
import { Image, ImageStyle, View } from "react-native";
import { Paths } from "expo-file-system";

import { MushafVersion, QuranTheme } from "@/enums/quran";
import { QURAN_THEME_COLORS } from "@/constants/Quran";

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

  const containerStyle = useMemo(
    () => ({
      width: screenWidth,
      height: lineHeight,
      overflow: "hidden" as const,
    }),
    [screenWidth, lineHeight]
  );

  const imageStyle: ImageStyle = useMemo(
    () => ({
      width: screenWidth,
      height: lineHeight,
      tintColor: themeColors.textTint,
    }),
    [screenWidth, lineHeight, themeColors.textTint]
  );

  return (
    <View style={containerStyle}>
      <Image source={{ uri }} style={imageStyle} resizeMode="cover" />
    </View>
  );
};

export default LineImage;
