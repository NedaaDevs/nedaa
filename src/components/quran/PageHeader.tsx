import { View, XStack, YStack } from "tamagui";
import { useTranslation } from "react-i18next";

import { Text } from "@/components/ui/text";
import { QuranTheme } from "@/enums/quran";
import { QURAN_THEME_COLORS } from "@/constants/Quran";
import { juzLabel } from "@/utils/juz";
import { metadataFontFamily } from "@/utils/surahName";
import { useQuranStore } from "@/stores/quran";

interface PageHeaderProps {
  surahName: string;
  // null while the page is still downloading — header stays blank, not stale.
  juz: number | null;
  quranTheme: QuranTheme;
}

// Mushaf-authentic running header: surah and juz at the outer edges with the
// Mihrab diamond ornament centered, over a hairline rule.
const PageHeader = ({ surahName, juz, quranTheme }: PageHeaderProps) => {
  const { t } = useTranslation();
  const themeColors = QURAN_THEME_COLORS[quranTheme];
  const showOrnament = useQuranStore((s) => s.showHeaderOrnament);
  const fontFamily = metadataFontFamily();

  const juzText = juz ? juzLabel(juz) : "";

  return (
    <YStack
      paddingHorizontal="$3"
      paddingTop="$1"
      accessibilityRole="header"
      accessibilityLabel={t("a11y.quran.pageInfo", { page: "", surah: surahName, juz: juz ?? "" })}>
      <View position="relative" justifyContent="center">
        <XStack alignItems="center" justifyContent="space-between">
          <Text style={{ color: themeColors.headerColor, fontFamily }}>{surahName}</Text>
          <Text style={{ color: themeColors.headerColor, fontFamily }}>{juzText}</Text>
        </XStack>
        {/* Centered ornament, independent of the surah/juz text widths. */}
        {showOrnament && (
          <View
            position="absolute"
            top={0}
            bottom={0}
            left={0}
            right={0}
            alignItems="center"
            justifyContent="center"
            pointerEvents="none">
            <Text style={{ color: themeColors.frameColor, fontSize: 11, letterSpacing: 3 }}>
              ◆ ◆ ◆
            </Text>
          </View>
        )}
      </View>
      <View height={1} marginTop="$1.5" backgroundColor={themeColors.frameColor} opacity={0.28} />
    </YStack>
  );
};

export default PageHeader;
