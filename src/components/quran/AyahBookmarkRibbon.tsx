import { View } from "react-native";
import { Bookmark } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { BookmarkColor } from "@/enums/quran";
import { BOOKMARK_COLORS } from "@/constants/Quran";

interface AyahBookmarkRibbonProps {
  x: number;
  y: number;
  width: number;
  height: number;
  color: BookmarkColor;
  surahNumber: number;
  ayahNumber: number;
}

// Replaces a bookmarked ayah's numbered end-marker with a coloured ribbon. Plain
// non-interactive View — taps are hit-tested against glyph coords, not this.
const AyahBookmarkRibbon = ({
  x,
  y,
  width,
  height,
  color,
  surahNumber,
  ayahNumber,
}: AyahBookmarkRibbonProps) => {
  const { t } = useTranslation();
  const size = Math.min(width, height) * 1.15;
  const solid = BOOKMARK_COLORS[color].solid;
  return (
    <View
      accessibilityLabel={t("a11y.quran.ayahBookmarked", { surah: surahNumber, ayah: ayahNumber })}
      style={{
        position: "absolute",
        left: x + (width - size) / 2,
        top: y + (height - size) / 2,
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
      }}>
      <Bookmark size={size} color={solid} fill={solid} />
    </View>
  );
};

export default AyahBookmarkRibbon;
