import { YStack } from "tamagui";
import { useTranslation } from "react-i18next";

import { Text } from "@/components/ui/text";
import { QuranTheme } from "@/enums/quran";
import { QURAN_THEME_COLORS } from "@/constants/Quran";

interface PageNumberProps {
  page: number;
  quranTheme: QuranTheme;
}

const PageNumber = ({ page, quranTheme }: PageNumberProps) => {
  const { t } = useTranslation();
  const themeColors = QURAN_THEME_COLORS[quranTheme];

  return (
    <YStack alignItems="center" paddingVertical="$2">
      <Text
        style={{ color: themeColors.pageNumberColor }}
        accessibilityLabel={t("a11y.quran.page", { page })}>
        {String(page)}
      </Text>
    </YStack>
  );
};

export default PageNumber;
