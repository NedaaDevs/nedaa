import { YStack } from "tamagui";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { Text } from "@/components/ui/text";
import { QuranTheme } from "@/enums/quran";
import { QURAN_THEME_COLORS, QURAN_FONT_FAMILY, toHafsDigits } from "@/constants/Quran";

interface PageNumberProps {
  page: number;
  quranTheme: QuranTheme;
}

// Ornate parentheses (U+FD3F/U+FD3E) bracket the page number — code order is the
// RTL reading order, so it renders ﴾ N ﴿. Bottom padding clears the home-
// indicator / swipe-to-close strip.
const PageNumber = ({ page, quranTheme }: PageNumberProps) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const themeColors = QURAN_THEME_COLORS[quranTheme];

  return (
    <YStack alignItems="center" paddingTop="$2" style={{ paddingBottom: insets.bottom }}>
      <Text
        style={{
          color: themeColors.frameColor,
          fontFamily: QURAN_FONT_FAMILY,
          writingDirection: "rtl",
          fontSize: 19,
        }}
        accessibilityLabel={t("a11y.quran.page", { page })}>
        {`﴿ ${toHafsDigits(page)} ﴾`}
      </Text>
    </YStack>
  );
};

export default PageNumber;
