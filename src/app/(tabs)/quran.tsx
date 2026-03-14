import { Pressable } from "react-native";
import { XStack, YStack } from "tamagui";

import { Text } from "@/components/ui/text";
import { useQuranStore } from "@/stores/quran";
import { QURAN_THEME_COLORS } from "@/constants/Quran";
import { MushafVersion } from "@/enums/quran";
import QuranPage from "@/components/quran/QuranPage";

const VERSIONS = [MushafVersion.V1, MushafVersion.V2, MushafVersion.V4];

const QuranScreen = () => {
  const { currentPage, currentVersion, quranTheme, setCurrentVersion } = useQuranStore();
  const themeColors = QURAN_THEME_COLORS[quranTheme];

  return (
    <YStack flex={1} style={{ backgroundColor: themeColors.background }}>
      <QuranPage page={currentPage} version={currentVersion} quranTheme={quranTheme} />

      <XStack
        position="absolute"
        bottom={100}
        alignSelf="center"
        gap="$2"
        backgroundColor="$backgroundSecondary"
        borderRadius="$4"
        padding="$2">
        {VERSIONS.map((v) => (
          <Pressable
            key={v}
            onPress={() => setCurrentVersion(v)}
            accessibilityRole="button"
            accessibilityLabel={`Switch to ${v}`}>
            <XStack
              paddingHorizontal="$3"
              paddingVertical="$1.5"
              borderRadius="$3"
              backgroundColor={currentVersion === v ? "$primary" : "transparent"}>
              <Text
                size="sm"
                fontWeight={currentVersion === v ? "700" : "400"}
                color={currentVersion === v ? "white" : "$typography"}>
                {v.toUpperCase()}
              </Text>
            </XStack>
          </Pressable>
        ))}
      </XStack>
    </YStack>
  );
};

export default QuranScreen;
