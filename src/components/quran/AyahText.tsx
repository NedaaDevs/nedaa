import { useCallback } from "react";
import { Pressable, Text, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";

import { QuranTheme } from "@/enums/quran";
import { QURAN_THEME_COLORS, QURAN_FONT_FAMILY, toHafsDigits } from "@/constants/Quran";

interface AyahTextProps {
  surahNumber: number;
  ayahNumber: number;
  text: string;
  fontSize: number;
  quranTheme: QuranTheme;
  isHighlighted: boolean;
  onLongPress: (surahNumber: number, ayahNumber: number) => void;
}

const AyahText = ({
  surahNumber,
  ayahNumber,
  text,
  fontSize,
  quranTheme,
  isHighlighted,
  onLongPress,
}: AyahTextProps) => {
  const { t } = useTranslation();
  const themeColors = QURAN_THEME_COLORS[quranTheme];

  const handleLongPress = useCallback(() => {
    onLongPress(surahNumber, ayahNumber);
  }, [surahNumber, ayahNumber, onLongPress]);

  // Ornamental parentheses + Hafs-style ayah number
  const markerText = ` \uFD3F${toHafsDigits(ayahNumber)}\uFD3E `;

  return (
    <Pressable
      onLongPress={handleLongPress}
      delayLongPress={400}
      accessibilityRole="text"
      accessibilityLabel={t("a11y.quran.ayahText", { surah: surahNumber, ayah: ayahNumber })}
      accessibilityState={{ selected: isHighlighted }}
      style={[styles.container, isHighlighted && { backgroundColor: themeColors.highlightColor }]}>
      <Text
        style={[
          styles.ayahText,
          {
            fontSize,
            lineHeight: fontSize * 1.8,
            color: themeColors.textTint ?? "#000",
            fontFamily: QURAN_FONT_FAMILY,
          },
        ]}>
        {text}
        <Text style={{ color: themeColors.markerColor, fontSize: fontSize * 0.85 }}>
          {markerText}
        </Text>
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 4,
    paddingVertical: 2,
    direction: "rtl",
    alignSelf: "stretch",
  },
  ayahText: {
    writingDirection: "rtl",
    textAlign: "justify",
  },
});

export default AyahText;
