import { useEffect, useState } from "react";
import { Image, Pressable, View } from "react-native";
import { YStack, XStack } from "tamagui";
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
import { BookOpen, Download, FileCheck, Loader, X } from "lucide-react-native";

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

// TEMP: two candidate fill visuals to compare on-device. Remove the loser and
// this toggle once a direction is chosen.
type FillMode = "preview" | "silhouette";

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
  const colored = isColoredVersion(version);

  const [fillMode, setFillMode] = useState<FillMode>("preview");
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
    : phase === DownloadPhase.DOWNLOADING
      ? t("quran.download.phaseDownloading")
      : phase === DownloadPhase.EXTRACTING
        ? t("quran.download.phaseExtracting")
        : t("quran.download.phaseFinalizing");

  const PhaseIcon = isComplete
    ? FileCheck
    : phase === DownloadPhase.DOWNLOADING
      ? Download
      : Loader;

  // The fully-inked page content, drawn full size; the clip/opacity styles
  // above reveal it as progress arrives.
  const fillContent =
    fillMode === "preview" && preview ? (
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
    ) : (
      <PageLines width={PAGE_WIDTH} height={pageHeight} color={chrome.accent} />
    );

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
        style={{
          width: PAGE_WIDTH,
          height: pageHeight,
          borderRadius: 12,
          overflow: "hidden",
          backgroundColor: PAPER.background,
          borderWidth: 1,
          borderColor: chrome.cardBorder,
        }}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: Math.round(fillTarget) }}>
        {/* Faint base layer (the not-yet-downloaded page) */}
        <View style={{ position: "absolute", opacity: 0.16 }}>
          {fillMode === "preview" && preview ? (
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
          ) : (
            <PageLines width={PAGE_WIDTH} height={pageHeight} color={chrome.subtleText} />
          )}
        </View>

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
            <View
              style={{ position: "absolute", bottom: 0, width: PAGE_WIDTH, height: pageHeight }}>
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
              <PhaseIcon size={16} color={isComplete ? chrome.accent : chrome.subtleText} />
              <Text fontSize={16} color={isComplete ? chrome.accent : chrome.subtleText}>
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
      ) : (
        <Pressable
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel={t("common.cancel")}
          hitSlop={8}>
          <XStack alignItems="center" gap="$1.5">
            <X size={15} color={chrome.subtleText} />
            <Text color={chrome.subtleText} fontSize={14} fontWeight="600">
              {t("common.cancel")}
            </Text>
          </XStack>
        </Pressable>
      )}

      {/* TEMP: compare the two fill visuals on-device, then keep one. */}
      <XStack
        position="absolute"
        bottom={insets.bottom + 12}
        gap="$2"
        opacity={0.8}
        borderWidth={1}
        borderColor={chrome.cardBorder}
        borderRadius={8}
        padding={4}>
        {(["preview", "silhouette"] as const).map((m) => (
          <Pressable key={m} onPress={() => setFillMode(m)} accessibilityRole="button">
            <YStack
              paddingHorizontal="$2.5"
              paddingVertical="$1"
              borderRadius={6}
              backgroundColor={fillMode === m ? chrome.accent : "transparent"}>
              <Text fontSize={11} color={fillMode === m ? "#fff" : chrome.subtleText}>
                {m}
              </Text>
            </YStack>
          </Pressable>
        ))}
      </XStack>
    </YStack>
  );
};

// A neutral mushaf-page silhouette: evenly spaced text-line bars. Used as the
// generic fill candidate (no tie to the chosen edition's actual page).
const PageLines = ({ width, height, color }: { width: number; height: number; color: string }) => {
  const lineCount = 9;
  const margin = width * 0.12;
  const gap = (height - margin * 2) / lineCount;
  return (
    <View style={{ width, height, paddingHorizontal: margin, paddingVertical: margin }}>
      {Array.from({ length: lineCount }).map((_, i) => (
        <View
          key={i}
          style={{
            height: 3,
            borderRadius: 2,
            backgroundColor: color,
            marginBottom: gap - 3,
            // Vary line length slightly to suggest justified text.
            width: i % 4 === 3 ? "62%" : "100%",
          }}
        />
      ))}
    </View>
  );
};

export default DownloadProgressScreen;
