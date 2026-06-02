import { useEffect, useState } from "react";
import { Image, Pressable } from "react-native";
import { View, XStack, YStack } from "tamagui";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MotiView, AnimatePresence } from "moti";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { BookOpen, Download, FileCheck, Loader, Pause, Play, X } from "lucide-react-native";

import { Text } from "@/components/ui/text";
import { useQuranStore } from "@/stores/quran";
import { useHaptic } from "@/hooks/useHaptic";
import { MushafVersion, QuranTheme, DownloadStatus, DownloadPhase } from "@/enums/quran";
import { QURAN_THEME_COLORS, isColoredVersion } from "@/constants/Quran";
import { useQuranChromeColors } from "@/hooks/useQuranChromeColors";
import { QuranManifestService, type QuranPreviewImage } from "@/services/quran-manifest";
import { QuranDownload } from "@/services/quran-download";

interface DownloadProgressScreenProps {
  version: MushafVersion;
  versionName: string;
  onStartReading: () => void;
  onCancel: () => void;
}

// The page visual is rendered like the reader (paper + ink), independent of the
// surrounding chrome which follows the app theme.
const PAPER = QURAN_THEME_COLORS[QuranTheme.SEPIA];
const PAGE_WIDTH = 168;
const DEFAULT_ASPECT = 1.45; // page is taller than wide; refined from the preview

const PHASE_LABEL_KEYS: Record<DownloadPhase, string> = {
  [DownloadPhase.DOWNLOADING]: "quran.download.phaseDownloading",
  [DownloadPhase.EXTRACTING]: "quran.download.phaseExtracting",
  [DownloadPhase.FINALIZING]: "quran.download.phaseFinalizing",
};

const PHASE_ICONS: Record<DownloadPhase, typeof Download> = {
  [DownloadPhase.DOWNLOADING]: Download,
  [DownloadPhase.EXTRACTING]: Loader,
  [DownloadPhase.FINALIZING]: Loader,
};

const DownloadProgressScreen = ({
  version,
  versionName,
  onStartReading,
  onCancel,
}: DownloadProgressScreenProps) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const hapticSuccess = useHaptic("success");
  const chrome = useQuranChromeColors();
  const reduceMotion = useReducedMotion();

  const downloadState = useQuranStore((s) => s.versionDownloads[version]);
  const progress = downloadState?.progress;
  const status = downloadState?.status ?? DownloadStatus.IDLE;

  const phase = progress?.phase ?? DownloadPhase.DOWNLOADING;
  const percent = progress?.percent ?? 0;
  const downloadedMB = progress ? Math.round(progress.bytesDownloaded / (1024 * 1024)) : 0;
  const totalMB = progress ? Math.round(progress.totalBytes / (1024 * 1024)) : 0;

  const isError = status === DownloadStatus.ERROR;
  const isComplete = status === DownloadStatus.COMPLETE;
  const isPaused = status === DownloadStatus.PAUSED;
  // Pause only applies to the byte transfer, not extract/finalize.
  const canPause = !isComplete && !isError && !isPaused && phase === DownloadPhase.DOWNLOADING;
  const colored = isColoredVersion(version);

  const [preview, setPreview] = useState<QuranPreviewImage | null>(null);

  useEffect(() => {
    let active = true;
    QuranManifestService.getVersionInfo(version).then((info) => {
      if (!active || !info) return;
      setPreview(QuranManifestService.getPreviews(info)[0] ?? null);
    });
    return () => {
      active = false;
    };
  }, [version]);

  const aspect = preview ? preview.height / preview.width : DEFAULT_ASPECT;
  const pageHeight = Math.round(PAGE_WIDTH * aspect);

  // The page fills with real download bytes; extract/finalize have no byte
  // progress, so the page is shown fully inked and the phase label carries the
  // remaining work. Linear motion reflects real progress; reduced-motion users
  // get a cross-fade (handled below) instead of positional travel.
  const fillTarget = isComplete ? 100 : phase === DownloadPhase.DOWNLOADING ? percent : 100;
  const fill = useSharedValue(0);

  useEffect(() => {
    fill.value = reduceMotion
      ? fillTarget
      : withTiming(fillTarget, { duration: 350, easing: Easing.linear });
  }, [fillTarget, reduceMotion, fill]);

  const clipStyle = useAnimatedStyle(() => ({ height: `${fill.value}%` }));
  const opacityStyle = useAnimatedStyle(() => ({ opacity: fill.value / 100 }));

  useEffect(() => {
    if (isComplete) hapticSuccess();
  }, [isComplete, hapticSuccess]);

  const phaseLabel = isComplete
    ? t("quran.download.complete")
    : isPaused
      ? t("quran.download.paused")
      : t(PHASE_LABEL_KEYS[phase]);

  const PhaseIcon = isComplete ? FileCheck : isPaused ? Pause : PHASE_ICONS[phase];

  const labelColor = isComplete
    ? chrome.accent
    : isPaused
      ? chrome.accentWarning
      : chrome.subtleText;

  // The fully-inked page, drawn full size; the clip/opacity styles above reveal
  // it as progress arrives. Absent until the preview image resolves.
  const fillContent = preview ? (
    <Image
      source={{ uri: preview.url }}
      style={{
        width: PAGE_WIDTH,
        height: pageHeight,
        tintColor: colored ? undefined : PAPER.textTint,
      }}
      resizeMode="cover"
      fadeDuration={0}
    />
  ) : null;

  return (
    <YStack
      flex={1}
      backgroundColor={chrome.background}
      paddingTop={insets.top + 24}
      paddingBottom={insets.bottom + 24}
      paddingHorizontal={20}
      alignItems="center"
      justifyContent="center"
      gap="$5">
      <Text fontSize={28} textAlign="center">
        ﷽
      </Text>

      <Text fontSize={18} fontWeight="600">
        {versionName}
      </Text>

      {/* Filling mushaf page */}
      <View
        width={PAGE_WIDTH}
        height={pageHeight}
        borderRadius={12}
        overflow="hidden"
        backgroundColor={PAPER.background}
        borderWidth={1}
        borderColor={chrome.cardBorder}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: Math.round(fillTarget) }}>
        {/* Faint base layer (the not-yet-downloaded page) */}
        {preview && (
          <View position="absolute" opacity={0.16}>
            <Image
              source={{ uri: preview.url }}
              style={{
                width: PAGE_WIDTH,
                height: pageHeight,
                tintColor: colored ? undefined : PAPER.textTint,
              }}
              resizeMode="cover"
              fadeDuration={0}
            />
          </View>
        )}

        {/* Fill layer — bottom-anchored reveal (or opacity for reduced motion) */}
        {reduceMotion ? (
          <Animated.View
            style={[{ position: "absolute", width: PAGE_WIDTH, height: pageHeight }, opacityStyle]}>
            {fillContent}
          </Animated.View>
        ) : (
          <Animated.View
            style={[
              { position: "absolute", bottom: 0, left: 0, right: 0, overflow: "hidden" },
              clipStyle,
            ]}>
            <View position="absolute" bottom={0} width={PAGE_WIDTH} height={pageHeight}>
              {fillContent}
            </View>
          </Animated.View>
        )}
      </View>

      {/* Phase label (icon + text, never color alone) */}
      <AnimatePresence exitBeforeEnter>
        <MotiView
          key={phaseLabel}
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 200 }}>
          <YStack alignItems="center" gap="$1.5">
            <XStack alignItems="center" gap="$2">
              <PhaseIcon size={16} color={labelColor} />
              <Text fontSize={16} color={labelColor}>
                {phaseLabel}
              </Text>
            </XStack>
            {!isComplete && phase === DownloadPhase.DOWNLOADING && totalMB > 0 && (
              <Text fontSize={12.5} color={chrome.subtleText}>
                {percent}% ·{" "}
                {t("quran.download.sizeProgress", { downloaded: downloadedMB, total: totalMB })}
              </Text>
            )}
          </YStack>
        </MotiView>
      </AnimatePresence>

      {/* Actions: Start reading only once complete (no auto-enter); retry on
          error; cancel while in flight. */}
      {isComplete ? (
        <Pressable
          onPress={onStartReading}
          accessibilityRole="button"
          accessibilityLabel={t("quran.onboarding.startReading")}>
          <XStack
            backgroundColor={chrome.accent}
            paddingHorizontal="$5"
            paddingVertical="$3"
            borderRadius={14}
            alignItems="center"
            gap="$2">
            <BookOpen size={18} color="#fff" />
            <Text color="#fff" fontWeight="700" fontSize={15}>
              {t("quran.onboarding.startReading")}
            </Text>
          </XStack>
        </Pressable>
      ) : isError ? (
        <Pressable
          onPress={() => QuranDownload.start(version)}
          accessibilityRole="button"
          accessibilityLabel={t("quran.download.retry")}>
          <XStack
            backgroundColor={chrome.accent}
            paddingHorizontal="$4"
            paddingVertical="$2.5"
            borderRadius="$3"
            alignItems="center">
            <Text color="#fff" fontWeight="600">
              {t("quran.download.retry")}
            </Text>
          </XStack>
        </Pressable>
      ) : isPaused ? (
        <XStack alignItems="center" gap="$4">
          <Pressable
            onPress={() => QuranDownload.resume(version)}
            accessibilityRole="button"
            accessibilityLabel={t("quran.download.resume")}>
            <XStack
              backgroundColor={chrome.accent}
              paddingHorizontal="$5"
              paddingVertical="$3"
              borderRadius={14}
              alignItems="center"
              gap="$2">
              <Play size={18} color="#fff" />
              <Text color="#fff" fontWeight="700" fontSize={15}>
                {t("quran.download.resume")}
              </Text>
            </XStack>
          </Pressable>
          <CancelControl onCancel={onCancel} color={chrome.subtleText} label={t("common.cancel")} />
        </XStack>
      ) : (
        <XStack alignItems="center" gap="$4">
          {canPause && (
            <Pressable
              onPress={() => QuranDownload.pause(version)}
              accessibilityRole="button"
              accessibilityLabel={t("quran.download.pause")}
              hitSlop={8}>
              <XStack alignItems="center" gap="$1.5">
                <Pause size={15} color={chrome.subtleText} />
                <Text color={chrome.subtleText} fontSize={14} fontWeight="600">
                  {t("quran.download.pause")}
                </Text>
              </XStack>
            </Pressable>
          )}
          <CancelControl onCancel={onCancel} color={chrome.subtleText} label={t("common.cancel")} />
        </XStack>
      )}
    </YStack>
  );
};

const CancelControl = ({
  onCancel,
  color,
  label,
}: {
  onCancel: () => void;
  color: `#${string}`;
  label: string;
}) => (
  <Pressable onPress={onCancel} accessibilityRole="button" accessibilityLabel={label} hitSlop={8}>
    <XStack alignItems="center" gap="$1.5">
      <X size={15} color={color} />
      <Text color={color} fontSize={14} fontWeight="600">
        {label}
      </Text>
    </XStack>
  </Pressable>
);

export default DownloadProgressScreen;
