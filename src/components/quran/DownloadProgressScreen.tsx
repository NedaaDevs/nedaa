import { useCallback, useEffect, useRef } from "react";
import { Pressable } from "react-native";
import { YStack, XStack } from "tamagui";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MotiView, AnimatePresence } from "moti";
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { Pause, Play } from "lucide-react-native";

import { Text } from "@/components/ui/text";
import { useQuranStore } from "@/stores/quran";
import { useHaptic } from "@/hooks/useHaptic";
import { MushafVersion, DownloadStatus } from "@/enums/quran";
import { MIN_PAGES_BEFORE_READING, QURAN_UI_COLORS } from "@/constants/Quran";
import { QuranDownload } from "@/services/quran-download";

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
  const hapticLight = useHaptic("light");
  const hapticSuccess = useHaptic("success");

  const downloadState = useQuranStore((s) => s.versionDownloads[version]);
  const progress = downloadState?.progress;
  const status = downloadState?.status ?? DownloadStatus.IDLE;

  const progressWidth = useSharedValue(0);
  const prevSurahRef = useRef("");

  const completedPages = progress?.completedPages ?? 0;
  const totalPages = progress?.totalPages ?? 604;
  const percent = totalPages > 0 ? Math.round((completedPages / totalPages) * 100) : 0;
  const downloadedMB = progress ? Math.round(progress.bytesDownloaded / (1024 * 1024)) : 0;
  const canStartReading = completedPages >= MIN_PAGES_BEFORE_READING;
  const surahName = progress?.currentSurahName ?? "";

  useEffect(() => {
    progressWidth.value = withTiming(percent, { duration: 300 });
  }, [percent, progressWidth]);

  useEffect(() => {
    if (surahName && surahName !== prevSurahRef.current) {
      prevSurahRef.current = surahName;
      hapticLight();
    }
  }, [surahName, hapticLight]);

  useEffect(() => {
    if (status === DownloadStatus.COMPLETE) {
      hapticSuccess();
      onStartReading();
    }
  }, [status, hapticSuccess, onStartReading]);

  const progressBarStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value}%`,
  }));

  const handlePauseResume = useCallback(() => {
    if (status === DownloadStatus.DOWNLOADING) {
      QuranDownload.pause();
    } else if (status === DownloadStatus.PAUSED) {
      QuranDownload.resume();
    } else if (status === DownloadStatus.ERROR) {
      QuranDownload.start(version);
    }
  }, [status, version]);

  const isPaused = status === DownloadStatus.PAUSED;
  const isError = status === DownloadStatus.ERROR;

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

      {/* Surah name with crossfade */}
      <AnimatePresence exitBeforeEnter>
        <MotiView
          key={surahName}
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 200 }}>
          <Text fontSize={16} color={QURAN_UI_COLORS.subtleText}>
            {t("quran.download.downloading", { surah: surahName || "..." })}
          </Text>
        </MotiView>
      </AnimatePresence>

      {/* Progress bar */}
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
            accessibilityValue={{ min: 0, max: totalPages, now: completedPages }}
          />
        </YStack>

        <XStack justifyContent="space-between">
          <Text fontSize={12} color={QURAN_UI_COLORS.subtleText}>
            {t("quran.download.pageProgress", {
              current: completedPages,
              total: totalPages,
              percent,
            })}
          </Text>
          <Text fontSize={12} color={QURAN_UI_COLORS.subtleText}>
            {t("quran.download.sizeProgress", {
              downloaded: downloadedMB,
              total: Math.round(progress?.totalBytes ? progress.totalBytes / (1024 * 1024) : 0),
            })}
          </Text>
        </XStack>

        {(progress?.failedPages ?? 0) > 0 && (
          <Text fontSize={12} color={QURAN_UI_COLORS.accentWarning}>
            {t("quran.download.failedPages", { count: progress?.failedPages })}
          </Text>
        )}
      </YStack>

      {/* Pause/Resume button */}
      <Pressable
        onPress={handlePauseResume}
        accessibilityRole="button"
        accessibilityLabel={
          isPaused ? t("a11y.quran.resumeDownload") : t("a11y.quran.pauseDownload")
        }>
        <XStack
          backgroundColor={QURAN_UI_COLORS.accent}
          paddingHorizontal="$4"
          paddingVertical="$2.5"
          borderRadius="$3"
          gap="$2"
          alignItems="center">
          {isPaused || isError ? <Play size={16} color="#fff" /> : <Pause size={16} color="#fff" />}
          <Text color="#fff" fontWeight="600">
            {isError
              ? t("quran.download.retry")
              : isPaused
                ? t("quran.download.resume")
                : t("quran.download.pause")}
          </Text>
        </XStack>
      </Pressable>

      {/* Start reading link */}
      {canStartReading && (
        <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 300 }}>
          <Pressable
            onPress={onStartReading}
            accessibilityRole="link"
            accessibilityLabel={t("quran.download.readWhileDownloading")}>
            <Text color={QURAN_UI_COLORS.accent} fontSize={14} fontWeight="500">
              {t("quran.download.readWhileDownloading")} →
            </Text>
          </Pressable>
        </MotiView>
      )}
    </YStack>
  );
};

export default DownloadProgressScreen;
