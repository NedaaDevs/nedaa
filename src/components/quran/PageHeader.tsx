import { XStack } from "tamagui";
import { useTranslation } from "react-i18next";

import { Text } from "@/components/ui/text";
import { QuranTheme } from "@/enums/quran";
import { QURAN_THEME_COLORS } from "@/constants/Quran";

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
      paddingHorizontal="$4"
      paddingVertical="$2"
      accessibilityRole="header"
      accessibilityLabel={t("a11y.quran.pageInfo", { page: "", surah: surahName, juz })}>
      <Text style={{ color: themeColors.headerColor }}>{surahName}</Text>
      <Text style={{ color: themeColors.headerColor }}>{t("a11y.quran.juz", { number: juz })}</Text>
    </XStack>
  );
};

export default PageHeader;
