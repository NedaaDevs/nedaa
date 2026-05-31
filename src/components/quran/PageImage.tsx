import { useEffect, useMemo, useState } from "react";
import { Image, ImageStyle, View } from "react-native";
import { Paths } from "expo-file-system";

import { MushafVersion, QuranTheme } from "@/enums/quran";
import { QURAN_THEME_COLORS, IMAGE_SOURCE_WIDTH, isColoredVersion } from "@/constants/Quran";

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
  const [sourceHeight, setSourceHeight] = useState(0);

  useEffect(() => {
    Image.getSize(uri, (_w, h) => setSourceHeight(h));
  }, [uri]);

  const scale = screenWidth / IMAGE_SOURCE_WIDTH;
  const scaledPageHeight = sourceHeight > 0 ? Math.round(sourceHeight * scale) : availableHeight;
  const scaleY = scaledPageHeight > 0 ? availableHeight / scaledPageHeight : 1;

  const containerStyle = useMemo(
    () => ({ width: screenWidth, height: availableHeight }),
    [screenWidth, availableHeight]
  );

  if (sourceHeight === 0) return <View style={containerStyle} />;

  const imageStyle: ImageStyle = {
    width: screenWidth,
    height: scaledPageHeight,
    transform: [{ scaleY }],
    transformOrigin: "top",
    // Colored mushafs keep their own ink; only monochrome ones are tinted.
    tintColor: isColoredVersion(version) ? undefined : themeColors.textTint,
  };

  return (
    <View style={containerStyle}>
      <Image source={{ uri }} style={imageStyle} fadeDuration={0} />
    </View>
  );
};

export default PageImage;
