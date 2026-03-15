import { Pressable } from "react-native";
import { XStack, YStack } from "tamagui";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { X, Sun, Moon, BookOpen } from "lucide-react-native";

import { Text } from "@/components/ui/text";
import { useQuranStore } from "@/stores/quran";
import { QURAN_THEME_COLORS } from "@/constants/Quran";
import { MushafVersion, QuranTheme } from "@/enums/quran";
import QuranReader from "@/components/quran/QuranReader";

const VERSIONS = [MushafVersion.V1, MushafVersion.V2, MushafVersion.V4];

const THEMES = [
  { key: QuranTheme.LIGHT, icon: Sun },
  { key: QuranTheme.SEPIA, icon: BookOpen },
  { key: QuranTheme.DARK, icon: Moon },
];

const QuranScreen = () => {
  const {
    currentPage,
    currentVersion,
    quranTheme,
    setCurrentVersion,
    setCurrentPage,
    setQuranTheme,
  } = useQuranStore();
  const themeColors = QURAN_THEME_COLORS[quranTheme];
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <YStack flex={1} style={{ backgroundColor: themeColors.background }}>
      <QuranReader
        currentPage={currentPage}
        version={currentVersion}
        quranTheme={quranTheme}
        onPageChange={setCurrentPage}
      />

      <Pressable
        onPress={() => router.navigate("/")}
        accessibilityRole="button"
        accessibilityLabel="Close reader"
        style={{
          position: "absolute",
          top: insets.top + 8,
          right: 16,
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: "rgba(0,0,0,0.15)",
          alignItems: "center",
          justifyContent: "center",
        }}>
        <X color={themeColors.headerColor} size={18} />
      </Pressable>

      <XStack
        position="absolute"
        bottom={insets.bottom + 44}
        alignSelf="center"
        gap="$1.5"
        backgroundColor="$backgroundSecondary"
        borderRadius="$4"
        padding="$1.5">
        {THEMES.map(({ key, icon: Icon }) => (
          <Pressable
            key={key}
            onPress={() => setQuranTheme(key)}
            accessibilityRole="button"
            accessibilityLabel={`${key} theme`}>
            <XStack
              padding="$2"
              borderRadius="$3"
              backgroundColor={quranTheme === key ? "$primary" : "transparent"}>
              <Icon color={quranTheme === key ? "white" : "#888"} size={16} />
            </XStack>
          </Pressable>
        ))}
      </XStack>

      <XStack
        position="absolute"
        bottom={insets.bottom + 4}
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
