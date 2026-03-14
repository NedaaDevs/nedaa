import { YStack } from "tamagui";

import { useQuranStore } from "@/stores/quran";
import { QURAN_THEME_COLORS } from "@/constants/Quran";
import QuranPage from "@/components/quran/QuranPage";

const QuranScreen = () => {
  const { currentPage, currentVersion, quranTheme } = useQuranStore();
  const themeColors = QURAN_THEME_COLORS[quranTheme];

  return (
    <YStack flex={1} style={{ backgroundColor: themeColors.background }}>
      <QuranPage page={currentPage} version={currentVersion} quranTheme={quranTheme} />
    </YStack>
  );
};

export default QuranScreen;
