import { useCallback } from "react";
import { Text } from "react-native";

import { BookmarkColor, HighlightColor, QuranTheme } from "@/enums/quran";
import {
  QURAN_THEME_COLORS,
  HIGHLIGHT_COLORS,
  BOOKMARK_COLORS,
  highlightTint,
  toArabicDigits,
} from "@/constants/Quran";

interface AyahTextProps {
  surahNumber: number;
  ayahNumber: number;
  text: string;
  quranTheme: QuranTheme;
  isHighlighted: boolean;
  highlightColor?: HighlightColor | null;
  bookmarkColor?: BookmarkColor | null;
  onLongPress: (surahNumber: number, ayahNumber: number) => void;
}

// One ayah as an inline span in a surah's flowing text: the verse plus its
// ﴾number﴿ end-marker. Highlight tints the span; bookmark makes the marker a
// coloured pill. Font, size, and line-height are inherited from the parent Text.
const AyahText = ({
  surahNumber,
  ayahNumber,
  text,
  quranTheme,
  isHighlighted,
  highlightColor,
  bookmarkColor,
  onLongPress,
}: AyahTextProps) => {
  const themeColors = QURAN_THEME_COLORS[quranTheme];
  const num = toArabicDigits(ayahNumber);

  const handleLongPress = useCallback(
    () => onLongPress(surahNumber, ayahNumber),
    [surahNumber, ayahNumber, onLongPress]
  );

  const background = highlightColor
    ? highlightTint(highlightColor, quranTheme)
    : isHighlighted
      ? themeColors.highlightColor
      : undefined;
  const markerColor = highlightColor
    ? HIGHLIGHT_COLORS[highlightColor].solid
    : themeColors.markerColor;

  return (
    <Text
      onLongPress={handleLongPress}
      style={background ? { backgroundColor: background } : undefined}>
      {text}
      {bookmarkColor ? (
        <Text style={{ color: "#FFF8EE", backgroundColor: BOOKMARK_COLORS[bookmarkColor].solid }}>
          {` ${num} `}
        </Text>
      ) : (
        <Text style={{ color: markerColor }}>{` ﴿${num}﴾ `}</Text>
      )}
    </Text>
  );
};

export default AyahText;
