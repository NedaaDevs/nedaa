import { useWindowDimensions } from "react-native";
import { View, XStack, YStack } from "tamagui";
import { useTranslation } from "react-i18next";

import { Text } from "@/components/ui/text";
import { QuranThemeType } from "@/enums/quran";
import { QURAN_THEME_COLORS } from "@/constants/Quran";
import { LARGE_DEVICE_MIN_DP } from "@/utils/readerSpread";
import { headerJuzLabel } from "@/utils/juz";
import { metadataFontFamily } from "@/utils/surahName";

interface PageHeaderProps {
  surahName: string;
  // null while the page is still downloading — header stays blank, not stale.
  juz: number | null;
  quranTheme: QuranThemeType;
  // Spread page side (unused for ordering — the print convention is fixed).
  side?: "left" | "right" | "single";
}

// Running header, print-mushaf convention: surah at the physical left, juz at
// the physical right on every page. Hairline rule on phones only.
const PageHeader = ({ surahName, juz, quranTheme }: PageHeaderProps) => {
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  const isLarge = Math.min(width, height) >= LARGE_DEVICE_MIN_DP;
  const themeColors = QURAN_THEME_COLORS[quranTheme];
  const fontFamily = metadataFontFamily();

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
          <Text style={{ color: themeColors.headerColor, fontFamily }}>{surahName}</Text>
          <Text style={{ color: themeColors.headerColor, fontFamily }}>{juzText}</Text>
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
