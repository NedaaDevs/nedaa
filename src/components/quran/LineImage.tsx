import { useMemo } from "react";
import { Image, ImageStyle, View } from "react-native";
import { Paths } from "expo-file-system";

import { DownloadStatus, MushafVersion, QuranThemeType } from "@/enums/quran";
import { QURAN_THEME_COLORS, isColoredVersion, quranImageDirSegment } from "@/constants/Quran";
import { useQuranStore } from "@/stores/quran";

interface LineImageProps {
  version: MushafVersion;
  page: number;
  line: number;
  screenWidth: number;
  lineHeight: number;
  quranTheme: QuranThemeType;
}

const getLineImageUri = (dirSegment: string, page: number, line: number): string => {
  const pageStr = String(page).padStart(3, "0");
  const lineStr = String(line).padStart(3, "0");
  return `${Paths.document.uri}quran/${dirSegment}/lines/${pageStr}/${lineStr}.png`;
};

const LineImage = ({
  version,
  page,
  line,
  screenWidth,
  lineHeight,
  quranTheme,
}: LineImageProps) => {
  const darkAvailable = useQuranStore(
    (s) => s.versionDownloads[version]?.dark?.status === DownloadStatus.COMPLETE
  );
  const uri = getLineImageUri(quranImageDirSegment(version, quranTheme, darkAvailable), page, line);
  const themeColors = QURAN_THEME_COLORS[quranTheme];

  const containerStyle = useMemo(
    () => ({ width: screenWidth, height: lineHeight, overflow: "hidden" as const }),
    [screenWidth, lineHeight]
  );

  const imageStyle: ImageStyle = useMemo(
    () => ({
      width: screenWidth,
      height: lineHeight,
      // Colored mushafs keep their own ink; only monochrome ones are tinted.
      tintColor: isColoredVersion(version) ? undefined : themeColors.textTint,
    }),
    [screenWidth, lineHeight, themeColors.textTint, version]
  );

  return (
    <View style={containerStyle}>
      <Image source={{ uri }} style={imageStyle} resizeMode="cover" fadeDuration={0} />
    </View>
  );
};

export default LineImage;
