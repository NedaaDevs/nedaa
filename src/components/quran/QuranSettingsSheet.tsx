import { Pressable, StyleSheet } from "react-native";
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from "react-native-reanimated";
import { XStack, YStack } from "tamagui";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { X, Download, Check } from "lucide-react-native";

import { Text } from "@/components/ui/text";
import { MushafVersion, QuranTheme, DownloadStatus } from "@/enums/quran";
import { QURAN_UI_COLORS, QURAN_THEME_COLORS } from "@/constants/Quran";
import { useQuranStore } from "@/stores/quran";

interface QuranSettingsSheetProps {
  quranTheme: QuranTheme;
  onClose: () => void;
  onDownloadMore: () => void;
}

const VERSION_LABELS: Record<MushafVersion, string> = {
  [MushafVersion.V1]: "Madinah V1",
  [MushafVersion.V2]: "Madinah V2",
  [MushafVersion.V4]: "Madinah V4",
};

const QuranSettingsSheet = ({ quranTheme, onClose, onDownloadMore }: QuranSettingsSheetProps) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const themeColors = QURAN_THEME_COLORS[quranTheme];
  const { currentVersion, versionDownloads, setCurrentVersion } = useQuranStore();

  const downloadedVersions = Object.entries(versionDownloads)
    .filter(([, state]) => state?.status === DownloadStatus.COMPLETE)
    .map(([v]) => v as MushafVersion);

  const isDark = quranTheme === QuranTheme.DARK;
  const bgColor = isDark ? "#1E1E1E" : "#FFFFFF";
  const textColor = isDark ? "#E0D6C8" : "#2C1810";
  const subtleColor = isDark ? "#888" : QURAN_UI_COLORS.subtleText;
  const borderColor = isDark ? "#333" : QURAN_UI_COLORS.cardBorder;

  return (
    <>
      {/* Backdrop */}
      <Animated.View
        entering={FadeIn.duration(200)}
        exiting={FadeOut.duration(200)}
        style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View
        entering={SlideInDown.springify().damping(20).stiffness(200)}
        exiting={SlideOutDown.duration(200)}
        style={[
          styles.sheet,
          {
            backgroundColor: bgColor,
            paddingBottom: insets.bottom + 16,
          },
        ]}>
        {/* Header */}
        <XStack justifyContent="space-between" alignItems="center" paddingBottom="$3">
          <Text fontSize={18} fontWeight="700" color={textColor}>
            {t("quran.settings.title")}
          </Text>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t("common.close")}
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: borderColor,
              alignItems: "center",
              justifyContent: "center",
            }}>
            <X color={subtleColor} size={16} />
          </Pressable>
        </XStack>

        {/* Version list */}
        <YStack gap="$2">
          <Text fontSize={13} fontWeight="600" color={subtleColor}>
            {t("quran.settings.version")}
          </Text>

          {downloadedVersions.map((version) => {
            const isActive = version === currentVersion;
            return (
              <Pressable
                key={version}
                onPress={() => {
                  setCurrentVersion(version);
                  onClose();
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={`${VERSION_LABELS[version]}${isActive ? ", active" : ""}`}>
                <XStack
                  paddingVertical="$3"
                  paddingHorizontal="$3"
                  borderRadius="$3"
                  backgroundColor={
                    isActive
                      ? isDark
                        ? "rgba(255,255,255,0.08)"
                        : "rgba(0,0,0,0.04)"
                      : "transparent"
                  }
                  justifyContent="space-between"
                  alignItems="center">
                  <Text fontSize={15} fontWeight={isActive ? "600" : "400"} color={textColor}>
                    {VERSION_LABELS[version]}
                  </Text>
                  {isActive && <Check size={18} color={themeColors.markerColor} />}
                </XStack>
              </Pressable>
            );
          })}

          {/* Download more */}
          <Pressable
            onPress={onDownloadMore}
            accessibilityRole="button"
            accessibilityLabel={t("quran.settings.downloadMore")}>
            <XStack
              paddingVertical="$3"
              paddingHorizontal="$3"
              borderRadius="$3"
              gap="$2"
              alignItems="center">
              <Download size={16} color={QURAN_UI_COLORS.accent} />
              <Text fontSize={15} color={QURAN_UI_COLORS.accent} fontWeight="500">
                {t("quran.settings.downloadMore")}
              </Text>
            </XStack>
          </Pressable>
        </YStack>
      </Animated.View>
    </>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
    zIndex: 10,
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    zIndex: 11,
  },
});

export default QuranSettingsSheet;
