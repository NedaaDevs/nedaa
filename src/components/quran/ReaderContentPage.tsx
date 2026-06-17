import { ReactNode } from "react";
import { Pressable, ScrollView } from "react-native";
import { XStack, YStack } from "tamagui";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { StatusBar } from "expo-status-bar";
import { ArrowLeft, ArrowRight } from "lucide-react-native";

import { Text } from "@/components/ui/text";
import { QURAN_THEME_COLORS, isDarkPaper } from "@/constants/Quran";
import { useQuranStore } from "@/stores/quran";
import { useRTL } from "@/contexts/RTLContext";

// Full-screen reader sub-page (similar verses, tajweed, sajda) on the same paper
// theme as the reader so it feels continuous, with a back header. Reached from the
// ayah action sheet; back returns to the reader.
type Props = { title: string; subtitle?: string; children: ReactNode };

export const ReaderContentPage = ({ title, subtitle, children }: Props) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isRTL } = useRTL();
  const quranTheme = useQuranStore((s) => s.quranTheme);
  const c = QURAN_THEME_COLORS[quranTheme];
  const BackIcon = isRTL ? ArrowRight : ArrowLeft;

  return (
    <YStack flex={1} paddingTop={insets.top} style={{ backgroundColor: c.background }}>
      <StatusBar animated style={isDarkPaper(quranTheme) ? "light" : "dark"} />
      <XStack
        alignItems="center"
        gap="$3"
        paddingHorizontal="$3"
        paddingVertical="$2"
        borderBottomWidth={1}
        borderBottomColor={c.frameColor}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t("common.back")}
          hitSlop={8}
          style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}>
          <BackIcon color={c.headerColor} size={24} />
        </Pressable>
        <YStack flex={1}>
          <Text fontSize={17} fontWeight="700" color={c.headerColor}>
            {title}
          </Text>
          {subtitle ? (
            <Text fontSize={12} color={c.pageNumberColor}>
              {subtitle}
            </Text>
          ) : null}
        </YStack>
      </XStack>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, gap: 12 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
    </YStack>
  );
};
