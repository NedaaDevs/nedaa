import { Pressable, ScrollView, StyleSheet } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  useReducedMotion,
} from "react-native-reanimated";
import { XStack, YStack } from "tamagui";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react-native";

import { Text } from "@/components/ui/text";
import { useQuranChromeColors } from "@/hooks/useQuranChromeColors";
import QuickSettingsRow from "@/components/quran/settings/QuickSettingsRow";
import MushafSection from "@/components/quran/settings/MushafSection";
import ReaderOptionsSection from "@/components/quran/settings/ReaderOptionsSection";
import MaintenanceSection from "@/components/quran/settings/MaintenanceSection";

interface QuranSettingsSheetProps {
  onClose: () => void;
  onDownloadMore: () => void;
  onResetAll: () => Promise<void>;
}

const QuranSettingsSheet = ({ onClose, onDownloadMore, onResetAll }: QuranSettingsSheetProps) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const chrome = useQuranChromeColors();
  const reduceMotion = useReducedMotion();

  return (
    <>
      <Animated.View
        entering={reduceMotion ? undefined : FadeIn.duration(200)}
        exiting={reduceMotion ? undefined : FadeOut.duration(200)}
        style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t("common.close")}
        />
      </Animated.View>

      <Animated.View
        accessibilityViewIsModal
        entering={reduceMotion ? undefined : SlideInDown.duration(240)}
        exiting={reduceMotion ? undefined : SlideOutDown.duration(200)}
        style={[
          styles.sheet,
          { backgroundColor: chrome.background, paddingBottom: insets.bottom + 8 },
        ]}>
        <XStack justifyContent="space-between" alignItems="center" paddingBottom="$3">
          <Text fontSize={18} fontWeight="700" accessibilityRole="header">
            {t("quran.settings.title")}
          </Text>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t("common.close")}
            hitSlop={8}>
            <YStack
              width={32}
              height={32}
              borderRadius={16}
              backgroundColor={chrome.cardBorder}
              alignItems="center"
              justifyContent="center">
              <X color={chrome.subtleText} size={16} />
            </YStack>
          </Pressable>
        </XStack>

        <QuickSettingsRow chrome={chrome} />

        <ScrollView showsVerticalScrollIndicator={false}>
          <YStack gap="$5">
            <MushafSection chrome={chrome} onDownloadMore={onDownloadMore} onClose={onClose} />
            <ReaderOptionsSection chrome={chrome} />
            <MaintenanceSection chrome={chrome} onResetAll={onResetAll} />
          </YStack>
        </ScrollView>
      </Animated.View>
    </>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.4)",
    zIndex: 10,
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: "85%",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    zIndex: 11,
  },
});

export default QuranSettingsSheet;
