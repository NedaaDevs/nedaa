import { Alert, Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from "react-native-reanimated";
import { XStack, YStack } from "tamagui";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { X, Download, Check, Loader, Trash2 } from "lucide-react-native";

import { Text } from "@/components/ui/text";
import { MushafVersion, QuranTheme, DownloadStatus } from "@/enums/quran";
import { QURAN_UI_COLORS, QURAN_THEME_COLORS } from "@/constants/Quran";
import { useQuranStore } from "@/stores/quran";
import { QuranDownload } from "@/services/quran-download";

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

  const isDark = quranTheme === QuranTheme.DARK;
  const bgColor = isDark ? "#1E1E1E" : "#FFFFFF";
  const textColor = isDark ? "#E0D6C8" : "#2C1810";
  const subtleColor = isDark ? "#888" : QURAN_UI_COLORS.subtleText;
  const borderColor = isDark ? "#333" : QURAN_UI_COLORS.cardBorder;

  // All versions that are downloaded or downloading
  const allVersions = Object.entries(versionDownloads)
    .filter(
      ([, state]) =>
        state?.status === DownloadStatus.COMPLETE ||
        state?.status === DownloadStatus.DOWNLOADING ||
        state?.status === DownloadStatus.PAUSED ||
        state?.status === DownloadStatus.ERROR
    )
    .map(([v, state]) => ({ version: v as MushafVersion, state: state! }));

  return (
    <>
      <Animated.View
        entering={FadeIn.duration(200)}
        exiting={FadeOut.duration(200)}
        style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <Animated.View
        entering={SlideInDown.springify().damping(20).stiffness(200)}
        exiting={SlideOutDown.duration(200)}
        style={[styles.sheet, { backgroundColor: bgColor, paddingBottom: insets.bottom + 16 }]}>
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

          {allVersions.map(({ version, state }) => {
            const isActive = version === currentVersion;
            const isComplete = state.status === DownloadStatus.COMPLETE;
            const isDownloading =
              state.status === DownloadStatus.DOWNLOADING || state.status === DownloadStatus.PAUSED;
            const isError = state.status === DownloadStatus.ERROR;
            const progress = state.progress;
            const percent =
              progress && progress.totalPages > 0
                ? Math.round((progress.completedPages / progress.totalPages) * 100)
                : 0;

            const canSwitch = isComplete || percent > 0;

            return (
              <Pressable
                key={version}
                onPress={() => {
                  if (canSwitch) {
                    setCurrentVersion(version);
                    onClose();
                  }
                  if (isDownloading || isError) {
                    QuranDownload.start(version);
                  }
                }}
                accessibilityRole={canSwitch ? "radio" : "none"}
                accessibilityState={canSwitch ? { selected: isActive } : undefined}
                accessibilityLabel={`${VERSION_LABELS[version]}${isActive ? ", active" : ""}${isDownloading ? `, downloading ${percent}%` : ""}`}>
                <YStack
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
                  gap="$1.5">
                  <XStack justifyContent="space-between" alignItems="center">
                    <XStack alignItems="center" gap="$2">
                      <Text fontSize={15} fontWeight={isActive ? "600" : "400"} color={textColor}>
                        {VERSION_LABELS[version]}
                      </Text>
                      {isDownloading && <Loader size={14} color={subtleColor} />}
                    </XStack>
                    <XStack alignItems="center" gap="$2">
                      {isActive && isComplete && (
                        <Check size={18} color={themeColors.markerColor} />
                      )}
                      {isDownloading && (
                        <Text fontSize={12} color={subtleColor}>
                          {percent}%
                        </Text>
                      )}
                      {isError && (
                        <Text fontSize={12} color={QURAN_UI_COLORS.accentWarning}>
                          {t("quran.download.retry")}
                        </Text>
                      )}
                      {isComplete && !isActive && (
                        <Pressable
                          onPress={() => {
                            Alert.alert(
                              t("quran.settings.deleteTitle"),
                              t("quran.settings.deleteMessage", {
                                name: VERSION_LABELS[version],
                              }),
                              [
                                { text: t("common.cancel"), style: "cancel" },
                                {
                                  text: t("common.delete"),
                                  style: "destructive",
                                  onPress: () => QuranDownload.deleteVersion(version),
                                },
                              ]
                            );
                          }}
                          accessibilityRole="button"
                          accessibilityLabel={t("quran.settings.deleteVersion", {
                            name: VERSION_LABELS[version],
                          })}
                          hitSlop={8}>
                          <Trash2 size={16} color={subtleColor} />
                        </Pressable>
                      )}
                    </XStack>
                  </XStack>

                  {/* Progress bar for downloading versions */}
                  {isDownloading && (
                    <View
                      style={{
                        height: 3,
                        backgroundColor: borderColor,
                        borderRadius: 2,
                        overflow: "hidden",
                      }}>
                      <View
                        style={{
                          height: 3,
                          width: `${percent}%`,
                          backgroundColor: themeColors.markerColor,
                          borderRadius: 2,
                        }}
                      />
                    </View>
                  )}
                </YStack>
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
