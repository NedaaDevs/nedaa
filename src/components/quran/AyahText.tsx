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
  // True while this verse is the one currently being recited (read-along). Tints
  // the whole verse in the theme accent — used in verse granularity, or as the
  // word-mode fallback when a verse can't be tracked word-by-word.
  isReadAlong?: boolean;
  // 1-based ordinal of the recited word within this verse (word granularity); tints
  // just that word — the text-mode equivalent of the mushaf's moving rectangle.
  readAlongWordIndex?: number;
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
  isReadAlong,
  readAlongWordIndex,
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

  // Split into word tokens so waqf-bearing words are tappable and the recited word
  // can be tinted. Whole words stay intact, so Arabic shaping and the combining
  // stop-marks render correctly (a per-character split would detach the marks and
  // break letter joining; spaces already break letter joining, so word tokens are
  // safe). Untouched runs coalesce into one string to keep the node count low.
  const verseNodes = useMemo<ReactNode>(() => {
    if (!onWaqfPress && readAlongWordIndex == null) return text;
    const out: ReactNode[] = [];
    let buf = "";
    let key = 0;
    let wordOrdinal = 0;
    const flush = () => {
      if (buf) {
        out.push(buf);
        buf = "";
      }
    };
    for (const part of text.split(/(\s+)/)) {
      if (part.length === 0) continue;
      if (/^\s+$/.test(part)) {
        buf += part;
        continue;
      }
      // Only letter-bearing tokens are words. Standalone ornaments (۞ ۩) and waqf
      // signs are symbols/marks the canonical word list folds into their word, so
      // counting them would shift every highlight after them.
      if (/\p{L}/u.test(part)) wordOrdinal++;
      const waqfChar = onWaqfPress ? [...part].find((c) => WAQF_CHARS.has(c)) : undefined;
      const id = waqfChar ? waqfIdForChar(waqfChar) : undefined;
      const recited = readAlongWordIndex != null && wordOrdinal === readAlongWordIndex;
      if (!id && !recited) {
        buf += part;
        continue;
      }
      flush();
      out.push(
        <Text
          key={`w${key++}`}
          onPress={id ? () => onWaqfPress?.(id) : undefined}
          style={recited ? { color: themeColors.markerColor } : undefined}>
          {part}
        </Text>
      );
    }
    flush();
    return out;
  }, [text, onWaqfPress, readAlongWordIndex, themeColors.markerColor]);

  return (
    <Text
      onLongPress={handleLongPress}
      style={[
        background ? { backgroundColor: background } : null,
        // Whole-verse read-along tint (verse granularity, or the word-mode fallback
        // for untrackable verses). In word mode a single word is tinted inside
        // verseNodes instead, so don't colour the whole span. The ﴾number﴿ keeps
        // its own marker colour.
        isReadAlong && readAlongWordIndex == null ? { color: themeColors.markerColor } : null,
      ]}>
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
