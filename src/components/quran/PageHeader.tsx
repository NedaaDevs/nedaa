import { useWindowDimensions } from "react-native";
import { View, XStack, YStack } from "tamagui";
import { useTranslation } from "react-i18next";

import { Text } from "@/components/ui/text";
import { QuranThemeType } from "@/enums/quran";
import { ORNAMENT_INKS, QURAN_THEME_COLORS } from "@/constants/Quran";
import { LARGE_DEVICE_MIN_DP } from "@/utils/readerSpread";
import { headerJuzLabel } from "@/utils/juz";
import { ornamentThemeSlot } from "@/utils/quranOrnaments";
import {
  headerSurahLabel,
  JUZ_NAME_LIGATURE_FONT,
  juzNameLigature,
  metadataFontFamily,
  SURAH_NAME_LIGATURE_FONT,
  surahNameLigature,
} from "@/utils/surahName";

interface PageHeaderProps {
  surahName: string;
  // Enables the vocalized print-form label; fallback is prefix + surahName.
  surahNumber?: number | null;
  // null while the page is still downloading — header stays blank, not stale.
  juz: number | null;
  quranTheme: QuranThemeType;
  // Spread page side (unused for ordering — the print convention is fixed).
  side?: "left" | "right" | "single";
}

// Running header, print-mushaf convention: surah at the physical left, juz at
// the physical right on every page, one uniform script on both sides (the
// calligraphic name belongs to the surah frame band, not here). Hairline rule
// on phones only.
const PageHeader = ({ surahName, surahNumber, juz, quranTheme }: PageHeaderProps) => {
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  const isLarge = Math.min(width, height) >= LARGE_DEVICE_MIN_DP;
  const themeColors = QURAN_THEME_COLORS[quranTheme];
  const fontFamily = metadataFontFamily();
  // Same ornament ink as the footer holders' digits, so top and bottom
  // furniture read as one set.
  const inkColor = ORNAMENT_INKS[ornamentThemeSlot(quranTheme)];

  // Arabic-script locales render both sides as the mushaf's calligraphic
  // ligature glyphs (vocalized, matched style); Latin locales keep text.
  const surahLig = surahNumber != null ? surahNameLigature(surahNumber) : null;
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
      accessibilityRole="header"
      accessibilityLabel={t("a11y.quran.pageInfo", { page: "", surah: surahName, juz: juz ?? "" })}>
      <View position="relative" justifyContent="center">
        {/* direction ltr pins physical sides under RTL locales. */}
        <XStack alignItems="center" justifyContent="space-between" style={{ direction: "ltr" }}>
          <Text
            accessibilityLabel={surahText}
            style={{
              color: inkColor,
              fontFamily: surahLig ? SURAH_NAME_LIGATURE_FONT : fontFamily,
              fontSize: surahLig ? 20 : 14,
              // Calligraphic glyphs overflow the default text box — give them
              // headroom so marks/descenders don't clip.
              lineHeight: surahLig ? 30 : undefined,
              includeFontPadding: false,
            }}>
            {surahLig ?? surahText}
          </Text>
          <Text
            accessibilityLabel={juzText}
            style={{
              color: inkColor,
              fontFamily: juzLig ? JUZ_NAME_LIGATURE_FONT : fontFamily,
              fontSize: juzLig ? 20 : 14,
              lineHeight: juzLig ? 30 : undefined,
              includeFontPadding: false,
              // Optical lift — the juz glyph sits low in its em box.
              transform: juzLig ? [{ translateY: -2 }] : undefined,
            }}>
            {juzLig ?? juzText}
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
