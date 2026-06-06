import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { BookmarkColor } from "@/enums/quran";
import { BOOKMARK_COLORS, QURAN_FONT_FAMILY, toHafsDigits } from "@/constants/Quran";
import RibbonGlyph from "@/components/quran/RibbonGlyph";

interface AyahBookmarkRibbonProps {
  x: number;
  y: number;
  width: number;
  height: number;
  color: BookmarkColor;
  surahNumber: number;
  ayahNumber: number;
}

// A bookmarked verse's end-marker *is* a ribbon bearing the ayah number (replaces
// the rosette). Plain non-interactive overlay — taps hit-test glyph coords.
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
  const w = Math.min(width, height) * 0.98;
  const h = w * 1.3;
  return (
    <View
      accessibilityLabel={t("a11y.quran.ayahBookmarked", { surah: surahNumber, ayah: ayahNumber })}
      style={{
        position: "absolute",
        left: x + (width - w) / 2,
        top: y + (height - h) / 2,
        width: w,
        height: h,
        alignItems: "center",
        justifyContent: "center",
      }}>
      <View style={{ position: "absolute" }}>
        <RibbonGlyph size={h} color={BOOKMARK_COLORS[color].solid} />
      </View>
      <Text
        style={{
          fontSize: h * 0.32,
          fontWeight: "700",
          color: "#FFF8EE",
          fontFamily: QURAN_FONT_FAMILY,
          // Sit in the upper body, clear of the swallowtail.
          transform: [{ translateY: -h * 0.12 }],
        }}>
        {toHafsDigits(ayahNumber)}
      </Text>
    </View>
  );
};

export default AyahBookmarkRibbon;
