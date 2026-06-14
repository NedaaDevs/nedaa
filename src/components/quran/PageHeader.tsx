import { useWindowDimensions } from "react-native";
import { View, XStack, YStack } from "tamagui";
import { useTranslation } from "react-i18next";

import { Text } from "@/components/ui/text";
import { QuranThemeType } from "@/enums/quran";
import { QURAN_THEME_COLORS } from "@/constants/Quran";
import { LARGE_DEVICE_MIN_DP } from "@/utils/readerSpread";
import { juzLabel } from "@/utils/juz";
import { metadataFontFamily } from "@/utils/surahName";

interface PageHeaderProps {
  surahName: string;
  // null while the page is still downloading — header stays blank, not stale.
  juz: number | null;
  quranTheme: QuranThemeType;
  // Spread page side: the surah sits on the OUTER screen edge, juz toward the
  // spine. "single" (default) keeps the phone/single arrangement (surah leading).
  side?: "left" | "right" | "single";
}

// Mushaf-authentic running header: surah on the outer edge, juz toward the spine,
// over a hairline rule (phones only).
const PageHeader = ({ surahName, juz, quranTheme, side = "single" }: PageHeaderProps) => {
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  const isLarge = Math.min(width, height) >= LARGE_DEVICE_MIN_DP;
  const themeColors = QURAN_THEME_COLORS[quranTheme];
  const fontFamily = metadataFontFamily();

  const juzText = juz ? juzLabel(juz) : "";

  const surahEl = (
    <Text key="surah" style={{ color: themeColors.headerColor, fontFamily }}>
      {surahName}
    </Text>
  );
  const juzEl = (
    <Text key="juz" style={{ color: themeColors.headerColor, fontFamily }}>
      {juzText}
    </Text>
  );
  // Right page's outer edge is the right → surah trailing, juz toward the spine
  // (left). Left page and single keep surah leading on the outer/left edge.
  const headerOrder = side === "right" ? [juzEl, surahEl] : [surahEl, juzEl];

  return (
    <YStack
      paddingHorizontal="$3"
      paddingTop="$1"
      accessibilityRole="header"
      accessibilityLabel={t("a11y.quran.pageInfo", { page: "", surah: surahName, juz: juz ?? "" })}>
      <View position="relative" justifyContent="center">
        <XStack alignItems="center" justifyContent="space-between">
          {headerOrder}
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
