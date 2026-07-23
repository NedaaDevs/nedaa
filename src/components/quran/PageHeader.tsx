import { useWindowDimensions } from "react-native";
import { View, XStack, YStack } from "tamagui";
import { useTranslation } from "react-i18next";

import { Text } from "@/components/ui/text";
import { MushafVersion, QuranThemeType } from "@/enums/quran";
import { QURAN_THEME_COLORS, quranBodyInk } from "@/constants/Quran";
import { LARGE_DEVICE_MIN_DP } from "@/utils/readerSpread";
import { headerJuzLabel } from "@/utils/juz";
import {
  headerSurahLabel,
  JUZ_NAME_LIGATURE_FONT,
  juzNameLigature,
  metadataFontFamily,
  surahNameLigature,
  surahNameLigatureFont,
} from "@/utils/surahName";

interface PageHeaderProps {
  surahName: string;
  // Enables the vocalized print-form label; fallback is prefix + surahName.
  surahNumber?: number | null;
  // null while the page is still downloading — header stays blank, not stale.
  juz: number | null;
  // Picks the surah-name ligature font matching the page's script style.
  version: MushafVersion;
  quranTheme: QuranThemeType;
  // Spread page side (unused for ordering — the print convention is fixed).
  side?: "left" | "right" | "single";
  // Top safe-area clearance, set only by layouts that render the page flush to
  // the screen edge. Boxed and scroll-padded layouts already clear the edge.
  topInset?: number;
}

// Running header, print-mushaf convention: surah at the physical left, juz at
// the physical right on every page, one uniform script on both sides (the
// calligraphic name belongs to the surah frame band, not here). Hairline rule
// on phones only.
const PageHeader = ({
  surahName,
  surahNumber,
  juz,
  version,
  quranTheme,
  topInset = 0,
}: PageHeaderProps) => {
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  const isLarge = Math.min(width, height) >= LARGE_DEVICE_MIN_DP;
  const themeColors = QURAN_THEME_COLORS[quranTheme];
  const fontFamily = metadataFontFamily();
  // Body ink (black on light papers, white on dark), same token as the footer
  // holders' digits — the ornament artwork keeps its gold tint, the text doesn't.
  const textColor = quranBodyInk(quranTheme);

  // Both sides render the mushaf's calligraphic ligature glyphs in every app
  // locale — the running header belongs to the mushaf, not the UI. Localized
  // text survives as the accessibility labels.
  const surahLig = surahNumber != null ? surahNameLigature(surahNumber, version) : null;
  const juzLig = juz ? juzNameLigature(juz) : null;
  const surahText =
    surahNumber != null
      ? headerSurahLabel(surahNumber)
      : surahName
        ? `${t("quran.goto.surah")} ${surahName}`
        : "";
  const juzText = juz ? headerJuzLabel(juz) : "";

  return (
    <YStack
      paddingHorizontal="$3"
      paddingTop="$1"
      marginTop={topInset}
      accessibilityRole="header"
      accessibilityLabel={t("a11y.quran.pageInfo", { page: "", surah: surahName, juz: juz ?? "" })}>
      <View position="relative" justifyContent="center">
        {/* direction ltr pins physical sides under RTL locales. */}
        <XStack alignItems="center" justifyContent="space-between" style={{ direction: "ltr" }}>
          <Text
            accessibilityLabel={surahText}
            style={{
              color: textColor,
              fontFamily: surahLig ? surahNameLigatureFont(version) : fontFamily,
              fontSize: surahLig ? 20 : 14,
              // Calligraphic glyphs overflow the default text box — give them
              // headroom so marks/descenders don't clip.
              lineHeight: surahLig ? 30 : undefined,
              includeFontPadding: false,
            }}>
            {surahLig}
          </Text>
          <Text
            accessibilityLabel={juzText}
            style={{
              color: textColor,
              fontFamily: juzLig ? JUZ_NAME_LIGATURE_FONT : fontFamily,
              fontSize: juzLig ? 20 : 14,
              lineHeight: juzLig ? 30 : undefined,
              includeFontPadding: false,
              // Optical lift — the juz glyph sits low in its em box.
              transform: juzLig ? [{ translateY: -2 }] : undefined,
            }}>
            {juzLig}
          </Text>
        </XStack>
      </View>
      {/* Hairline rule under the header — dropped on tablets/foldables. */}
      {!isLarge && (
        <View height={1} marginTop="$1.5" backgroundColor={themeColors.frameColor} opacity={0.28} />
      )}
    </YStack>
  );
};

export default PageHeader;
