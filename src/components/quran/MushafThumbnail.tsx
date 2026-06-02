import { Image, View } from "react-native";

import { MushafVersion, QuranTheme } from "@/enums/quran";
import { QURAN_THEME_COLORS, isColoredVersion } from "@/constants/Quran";
import type { QuranPreviewImage } from "@/services/quran-manifest";

interface MushafThumbnailProps {
  preview: QuranPreviewImage;
  version: MushafVersion;
  width: number;
  radius?: number;
}

// Renders a preview page the way the reader does — transparent ink tinted onto
// paper for monochrome editions, untinted for the colour (tajweed) edition. The
// picker has no chosen reader theme yet, so it previews on the sepia paper.
const PAPER = QURAN_THEME_COLORS[QuranTheme.SEPIA];

const MushafThumbnail = ({ preview, version, width, radius = 8 }: MushafThumbnailProps) => {
  const height = Math.round(width * (preview.height / preview.width));
  const colored = isColoredVersion(version);

  return (
    <View
      style={{
        width,
        height,
        borderRadius: radius,
        overflow: "hidden",
        backgroundColor: PAPER.background,
      }}>
      <Image
        source={{ uri: preview.url }}
        style={{ width, height, tintColor: colored ? undefined : PAPER.textTint }}
        resizeMode="cover"
        fadeDuration={0}
      />
    </View>
  );
};

export default MushafThumbnail;
