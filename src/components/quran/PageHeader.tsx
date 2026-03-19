import { XStack } from "tamagui";
import { useTranslation } from "react-i18next";

import { Text } from "@/components/ui/text";
import { QuranTheme } from "@/enums/quran";
import { QURAN_THEME_COLORS, QURAN_FONT_FAMILY, toHafsDigits } from "@/constants/Quran";

interface PageHeaderProps {
  surahName: string;
  juz: number;
  quranTheme: QuranTheme;
}

const PageHeader = ({ surahName, juz, quranTheme }: PageHeaderProps) => {
  const { t } = useTranslation();
  const themeColors = QURAN_THEME_COLORS[quranTheme];

  return (
    <XStack
      justifyContent="space-between"
      paddingHorizontal="$3"
      paddingVertical="$1"
      accessibilityRole="header"
      accessibilityLabel={t("a11y.quran.pageInfo", { page: "", surah: surahName, juz })}>
      <Text style={{ color: themeColors.headerColor, fontFamily: QURAN_FONT_FAMILY }}>
        {surahName}
      </Text>
      <Text style={{ color: themeColors.headerColor, fontFamily: QURAN_FONT_FAMILY }}>
        {t("a11y.quran.juz", { number: toHafsDigits(juz) })}
      </Text>
    </XStack>
  );
};

export default PageHeader;
