import { useCallback } from "react";
import { Pressable, Text, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";

import { BookmarkColor, HighlightColor, QuranTheme } from "@/enums/quran";
import {
  QURAN_THEME_COLORS,
  QURAN_FONT_FAMILY,
  HIGHLIGHT_COLORS,
  BOOKMARK_COLORS,
  highlightTint,
  toHafsDigits,
} from "@/constants/Quran";

interface AyahTextProps {
  surahNumber: number;
  ayahNumber: number;
  text: string;
  fontSize: number;
  quranTheme: QuranTheme;
  isHighlighted: boolean;
  highlightColor?: HighlightColor | null;
  bookmarkColor?: BookmarkColor | null;
  onLongPress: (surahNumber: number, ayahNumber: number) => void;
}

const AyahText = ({
  surahNumber,
  ayahNumber,
  text,
  fontSize,
  quranTheme,
  isHighlighted,
  highlightColor,
  bookmarkColor,
  onLongPress,
}: AyahTextProps) => {
  const { t } = useTranslation();
  const themeColors = QURAN_THEME_COLORS[quranTheme];

  const handleLongPress = useCallback(() => {
    onLongPress(surahNumber, ayahNumber);
  }, [surahNumber, ayahNumber, onLongPress]);

  const hafs = toHafsDigits(ayahNumber);

  // Two planes, no conflict: the highlight is an interior wash across the verse;
  // the bookmark turns the inline end-marker into a coloured ribbon-pill bearing
  // the number (a verse can carry both — wash inside, ribbon at the marker).
  const background = highlightColor
    ? highlightTint(highlightColor, quranTheme)
    : isHighlighted
      ? themeColors.highlightColor
      : undefined;
  const markerColor = highlightColor
    ? HIGHLIGHT_COLORS[highlightColor].solid
    : themeColors.markerColor;

  return (
    <Pressable
      onLongPress={handleLongPress}
      delayLongPress={400}
      accessibilityRole="text"
      accessibilityLabel={t("a11y.quran.ayahText", { surah: surahNumber, ayah: ayahNumber })}
      accessibilityState={{ selected: isHighlighted || !!highlightColor || !!bookmarkColor }}
      style={[styles.container, background ? { backgroundColor: background } : null]}>
      <Text
        style={[
          styles.ayahText,
          {
            fontSize,
            // Hafs carries tall vowel marks; generous leading keeps lines from
            // crowding and reads calmer.
            lineHeight: fontSize * 2.05,
            color: themeColors.textTint ?? "#000",
            fontFamily: QURAN_FONT_FAMILY,
          },
        ]}>
        {text}{" "}
        {bookmarkColor ? (
          <Text
            style={{
              color: "#FFF8EE",
              backgroundColor: BOOKMARK_COLORS[bookmarkColor].solid,
              fontSize: fontSize * 0.78,
              fontFamily: QURAN_FONT_FAMILY,
            }}>
            {` ${hafs} `}
          </Text>
        ) : (
          <Text style={{ color: markerColor, fontSize: fontSize * 0.85 }}>{`﴿${hafs}﴾ `}</Text>
        )}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 6,
    paddingVertical: 4,
    alignSelf: "stretch",
  },
  ayahText: {
    // `writingDirection` (not the `direction` layout prop) drives RTL bidi; with
    // the layout prop gone, physical `textAlign: "right"` aligns every line —
    // including each ayah's short last line — to the right. NOT justify, which
    // stretched short verses edge-to-edge ("rivers").
    writingDirection: "rtl",
    textAlign: "right",
    width: "100%",
  },
});

export default AyahText;
