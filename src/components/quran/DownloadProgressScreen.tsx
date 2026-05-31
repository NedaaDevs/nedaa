import { useEffect } from "react";
import { ActivityIndicator, Pressable } from "react-native";
import { YStack, XStack } from "tamagui";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MotiView, AnimatePresence } from "moti";
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from "react-native-reanimated";
import { useTranslation } from "react-i18next";

import { Text } from "@/components/ui/text";
import { useQuranStore } from "@/stores/quran";
import { useHaptic } from "@/hooks/useHaptic";
import { MushafVersion, DownloadStatus } from "@/enums/quran";
import { QURAN_UI_COLORS } from "@/constants/Quran";

interface DownloadProgressScreenProps {
  version: MushafVersion;
  versionName: string;
  onStartReading: () => void;
}

const DownloadProgressScreen = ({
  version,
  versionName,
  onStartReading,
}: DownloadProgressScreenProps) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const hapticSuccess = useHaptic("success");

  const downloadState = useQuranStore((s) => s.versionDownloads[version]);
  const progress = downloadState?.progress;
  const status = downloadState?.status ?? DownloadStatus.IDLE;

  const phase = progress?.phase ?? "downloading";
  const percent = progress?.percent ?? 0;
  const downloadedMB = progress ? Math.round(progress.bytesDownloaded / (1024 * 1024)) : 0;
  const totalMB = progress ? Math.round(progress.totalBytes / (1024 * 1024)) : 0;

  const progressWidth = useSharedValue(0);

  useEffect(() => {
    progressWidth.value = withTiming(percent, { duration: 300 });
  }, [percent, progressWidth]);

  useEffect(() => {
    if (status === DownloadStatus.COMPLETE) {
      hapticSuccess();
      onStartReading();
    }
  }, [status, hapticSuccess, onStartReading]);

  const progressBarStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value}%`,
  }));

  const isError = status === DownloadStatus.ERROR;

  const phaseLabel =
    phase === "downloading"
      ? t("quran.download.phaseDownloading")
      : phase === "extracting"
        ? t("quran.download.phaseExtracting")
        : t("quran.download.phaseFinalizing");

  return (
    <YStack
      flex={1}
      backgroundColor={QURAN_UI_COLORS.background}
      paddingTop={insets.top + 24}
      paddingBottom={insets.bottom + 24}
      paddingHorizontal={20}
      alignItems="center"
      justifyContent="center"
      gap="$5">
      {/* Bismillah */}
      <Text fontSize={28} textAlign="center">
        ﷽
      </Text>

      {/* Version info */}
      <Text fontSize={18} fontWeight="600">
        {versionName}
      </Text>

      {/* Phase label */}
      <AnimatePresence exitBeforeEnter>
        <MotiView
          key={phase}
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 200 }}>
          <XStack alignItems="center" gap="$2">
            <ActivityIndicator size="small" color={QURAN_UI_COLORS.accent} />
            <Text fontSize={16} color={QURAN_UI_COLORS.subtleText}>
              {phaseLabel}
            </Text>
          </XStack>
        </MotiView>
      </AnimatePresence>

      {/* Determinate bar only when we actually have progress; the native
          downloader reports none, so the spinner above conveys activity. */}
      {phase === "downloading" && percent > 0 && (
        <YStack width="100%" gap="$2">
          <YStack
            width="100%"
            height={8}
            backgroundColor={QURAN_UI_COLORS.progressTrack}
            borderRadius={4}
            overflow="hidden">
            <Animated.View
              style={[
                {
                  height: 8,
                  backgroundColor: isError ? QURAN_UI_COLORS.accentWarning : QURAN_UI_COLORS.accent,
                  borderRadius: 4,
                },
                progressBarStyle,
              ]}
              accessibilityRole="progressbar"
              accessibilityValue={{ min: 0, max: 100, now: percent }}
            />
          </YStack>

          <XStack justifyContent="space-between">
            <Text fontSize={12} color={QURAN_UI_COLORS.subtleText}>
              {percent}%
            </Text>
            {totalMB > 0 && (
              <Text fontSize={12} color={QURAN_UI_COLORS.subtleText}>
                {downloadedMB} / {totalMB} MB
              </Text>
            )}
          </XStack>
        </YStack>
      )}

      {/* Error retry */}
      {isError && (
        <Pressable
          onPress={() => {
            import("@/services/quran-download").then(({ QuranDownload }) =>
              QuranDownload.start(version)
            );
          }}
          accessibilityRole="button"
          accessibilityLabel={t("quran.download.retry")}>
          <XStack
            backgroundColor={QURAN_UI_COLORS.accent}
            paddingHorizontal="$4"
            paddingVertical="$2.5"
            borderRadius="$3"
            alignItems="center">
            <Text color="#fff" fontWeight="600">
              {t("quran.download.retry")}
            </Text>
          </XStack>
        </Pressable>
      )}
    </YStack>
  );
};

export default DownloadProgressScreen;
