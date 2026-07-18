import { useEffect, useState } from "react";
import { Image, Pressable } from "react-native";
import { View, XStack, YStack } from "tamagui";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useRTL } from "@/contexts/RTLContext";
import { MotiView, AnimatePresence } from "moti";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Download,
  FileCheck,
  Loader,
  Pause,
  Play,
  X,
} from "lucide-react-native";

import { Text } from "@/components/ui/text";
import ReportThisButton from "@/components/ReportThisButton";
import { formatNumberToLocale } from "@/utils/number";
import { useQuranStore } from "@/stores/quran";
import { useHaptic } from "@/hooks/useHaptic";
import {
  MushafVersion,
  QuranTheme,
  DownloadStatus,
  DownloadPhase,
  DownloadStep,
} from "@/enums/quran";
import { DOWNLOAD_STEP_LABEL_KEYS, QURAN_THEME_COLORS, isColoredVersion } from "@/constants/Quran";
import { useQuranChromeColors } from "@/hooks/useQuranChromeColors";
import { QuranManifestService, type QuranPreviewImage } from "@/services/quran-manifest";
import { QuranDownload } from "@/services/quran-download";

interface DownloadProgressScreenProps {
  version: MushafVersion;
  versionName: string;
  onStartReading: () => void;
  onCancel: () => void;
  // Leaves the Qur'an flow entirely. The tab bar is hidden here, so without this there is no
  // way out. Distinct from onCancel, which stops the download and returns to version selection.
  onBack?: () => void;
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
  onBack,
}: DownloadProgressScreenProps) => {
  const { t } = useTranslation();
  const { isRTL } = useRTL();
  const BackIcon = isRTL ? ArrowRight : ArrowLeft;
  const insets = useSafeAreaInsets();
  const hapticSuccess = useHaptic("success");
  const chrome = useQuranChromeColors();
  const reduceMotion = useReducedMotion();

  const downloadState = useQuranStore((s) => s.versionDownloads[version]);
  const progress = downloadState?.progress;
  const status = downloadState?.status ?? DownloadStatus.IDLE;

  const step = progress?.step ?? DownloadStep.IMAGES;
  const phase = progress?.phase ?? DownloadPhase.DOWNLOADING;
  const percent = progress?.percent ?? 0;
  const downloadedMB = progress ? Math.round(progress.bytesDownloaded / (1024 * 1024)) : 0;
  const totalMB = progress ? Math.round(progress.totalBytes / (1024 * 1024)) : 0;

  const isError = status === DownloadStatus.ERROR;
  const isComplete = status === DownloadStatus.COMPLETE;
  const isPaused = status === DownloadStatus.PAUSED;
  // Pause only applies to the images byte transfer — ornament packs (step 2/2)
  // have no resumable transfer to pause.
  const canPause =
    !isComplete &&
    !isError &&
    !isPaused &&
    step === DownloadStep.IMAGES &&
    phase === DownloadPhase.DOWNLOADING;
  const colored = isColoredVersion(version);

  const [preview, setPreview] = useState<QuranPreviewImage | null>(null);

  useEffect(() => {
    let active = true;
    QuranManifestService.getVersionInfo(version).then(async (info) => {
      if (!active || !info) return;
      const previews = await QuranManifestService.getPreviews(info);
      if (active) setPreview(previews[0] ?? null);
    });
    return () => {
      active = false;
    };
  }, [version]);

  const aspect = preview ? preview.height / preview.width : DEFAULT_ASPECT;
  const pageHeight = Math.round(PAGE_WIDTH * aspect);

  // The page fills with real download bytes during step 1/2 (images); once
  // those land the page is shown fully inked and the step/phase labels carry
  // the remaining work (extract/finalize, then the ornament packs in step
  // 2/2). Linear motion reflects real progress; reduced-motion users get a
  // cross-fade (handled below) instead of positional travel.
  const fillTarget =
    isComplete || step !== DownloadStep.IMAGES
      ? 100
      : phase === DownloadPhase.DOWNLOADING
        ? percent
        : 100;
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

  const stepLabel = t(DOWNLOAD_STEP_LABEL_KEYS[step]);

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
      {onBack && (
        <Pressable
          onPress={onBack}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t("a11y.back")}
          style={{
            position: "absolute",
            top: insets.top + 12,
            ...(isRTL ? { right: 16 } : { left: 16 }),
            zIndex: 10,
          }}>
          <BackIcon size={24} color={chrome.subtleText} />
        </Pressable>
      )}

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
        accessibilityLabel={
          isComplete
            ? t("quran.download.complete")
            : t("a11y.quran.editionDownloadProgress", { step: stepLabel, phase: phaseLabel })
        }
        // Step 2/2 (ornaments) reports no byte progress; while it's still in
        // flight, a numeric now=100 would falsely announce completion, so
        // screen readers rely on the label instead. A true completion (any
        // step) still reports its accurate now=100.
        accessibilityValue={
          isComplete || step !== DownloadStep.ORNAMENTS
            ? { min: 0, max: 100, now: Math.round(fillTarget) }
            : undefined
        }>
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

      {/* Step + phase label (icon + text, never color alone) */}
      <AnimatePresence exitBeforeEnter>
        <MotiView
          key={`${step}-${phaseLabel}`}
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 200 }}>
          <YStack alignItems="center" gap="$1.5">
            {!isComplete && (
              <Text
                fontSize={11.5}
                fontWeight="700"
                color={chrome.subtleText}
                letterSpacing={0.3}
                textTransform="uppercase">
                {stepLabel}
              </Text>
            )}
            <XStack alignItems="center" gap="$2">
              <PhaseIcon size={16} color={labelColor} />
              <Text fontSize={16} color={labelColor}>
                {phaseLabel}
              </Text>
            </XStack>
            {!isComplete &&
              step === DownloadStep.IMAGES &&
              phase === DownloadPhase.DOWNLOADING &&
              totalMB > 0 && (
                <YStack width={PAGE_WIDTH} alignItems="center" gap="$2" paddingTop="$1">
                  <Text fontSize={14} fontWeight="700" color={chrome.text}>
                    {formatNumberToLocale(String(percent))}%
                  </Text>
                  {/* Linear progress line */}
                  <View
                    width="100%"
                    height={4}
                    borderRadius={2}
                    overflow="hidden"
                    backgroundColor={chrome.progressTrack}>
                    <View
                      height={4}
                      borderRadius={2}
                      backgroundColor={chrome.accent}
                      style={{ width: `${percent}%` }}
                    />
                  </View>
                  <Text fontSize={12.5} color={chrome.subtleText}>
                    {t("quran.download.sizeProgress", {
                      downloaded: formatNumberToLocale(String(downloadedMB)),
                      total: formatNumberToLocale(String(totalMB)),
                    })}
                  </Text>
                </YStack>
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
        <YStack alignItems="center" gap="$2">
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
          {/* A failed download must not be a dead end — same escape as paused/in-flight. */}
          <CancelControl onCancel={onCancel} color={chrome.subtleText} label={t("common.cancel")} />
          <ReportThisButton
            domains={["quran-download", "quran-content-db", "quran-manifest"]}
            category="Quran download"
          />
        </YStack>
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
