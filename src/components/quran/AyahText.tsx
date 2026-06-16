import { useCallback, useMemo, type ReactNode } from "react";
import { Text } from "react-native";

import { BookmarkColor, HighlightColor, QuranThemeType } from "@/enums/quran";
import {
  QURAN_THEME_COLORS,
  HIGHLIGHT_COLORS,
  BOOKMARK_COLORS,
  highlightTint,
  toArabicDigits,
} from "@/constants/Quran";
import { WAQF_CHARS, waqfIdForChar } from "@/services/guide-content";

interface AyahTextProps {
  surahNumber: number;
  ayahNumber: number;
  text: string;
  quranTheme: QuranThemeType;
  isHighlighted: boolean;
  // Briefly pulse the span (search-jump landing); animates its background tint.
  isFlashing?: boolean;
  highlightColor?: HighlightColor | null;
  bookmarkColor?: BookmarkColor | null;
  // Mark the verse as having similar verses (mutashabihat) — small trailing dot.
  hasSimilar?: boolean;
  onLongPress: (surahNumber: number, ayahNumber: number) => void;
  // Tap a waqf sign within the verse → its guide entry (Text-mode contextual).
  onWaqfPress?: (signId: string) => void;
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
  isFlashing,
  highlightColor,
  bookmarkColor,
  hasSimilar,
  onLongPress,
  onWaqfPress,
}: AyahTextProps) => {
  const themeColors = QURAN_THEME_COLORS[quranTheme];
  const num = toArabicDigits(ayahNumber);

  const handleLongPress = useCallback(
    () => onLongPress(surahNumber, ayahNumber),
    [surahNumber, ayahNumber, onLongPress]
  );

  // A long-press selection or a search-jump landing both tint the span with the
  // theme highlight; a saved highlight's own colour takes precedence.
  const background = highlightColor
    ? highlightTint(highlightColor, quranTheme)
    : isHighlighted || isFlashing
      ? themeColors.highlightColor
      : undefined;
  const markerColor = highlightColor
    ? HIGHLIGHT_COLORS[highlightColor].solid
    : themeColors.markerColor;

  // Split into word tokens, making only waqf-bearing words tappable. Whole words
  // stay intact, so Arabic shaping and the combining stop-marks render correctly
  // (a per-character split would detach the marks and break letter joining).
  const verseNodes = useMemo<ReactNode>(() => {
    if (!onWaqfPress) return text;
    const out: ReactNode[] = [];
    let buf = "";
    let key = 0;
    for (const part of text.split(/(\s+)/)) {
      const waqfChar = [...part].find((c) => WAQF_CHARS.has(c));
      const id = waqfChar ? waqfIdForChar(waqfChar) : undefined;
      if (id) {
        if (buf) {
          out.push(buf);
          buf = "";
        }
        out.push(
          <Text key={`w${key++}`} onPress={() => onWaqfPress(id)}>
            {part}
          </Text>
        );
      } else {
        buf += part;
      }
    }
    if (buf) out.push(buf);
    return out;
  }, [text, onWaqfPress]);

  return (
    <Text
      onLongPress={handleLongPress}
      style={background ? { backgroundColor: background } : undefined}>
      {verseNodes}
      {bookmarkColor ? (
        <Text style={{ color: "#FFF8EE", backgroundColor: BOOKMARK_COLORS[bookmarkColor].solid }}>
          {` ${num} `}
        </Text>
      ) : (
        <Text style={{ color: markerColor }}>{` ﴿${num}﴾ `}</Text>
      )}
      {hasSimilar ? <Text style={{ color: themeColors.markerColor }}>{"• "}</Text> : null}
    </Text>
  );
};

export default AyahText;
