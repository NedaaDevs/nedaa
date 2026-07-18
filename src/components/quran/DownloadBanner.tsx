import { Pressable, StyleSheet } from "react-native";
import { View, XStack } from "tamagui";
import Animated, { FadeInDown, FadeOutUp, useReducedMotion } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react-native";

import { Text } from "@/components/ui/text";
import { MushafVersion, DownloadStatus, DownloadPhase, DownloadStep } from "@/enums/quran";
import { DOWNLOAD_STEP_LABEL_KEYS } from "@/constants/Quran";
import { useQuranStore } from "@/stores/quran";
import { useQuranChromeColors } from "@/hooks/useQuranChromeColors";

interface DownloadBannerProps {
  onDismiss: () => void;
}

const DownloadBanner = ({ onDismiss }: DownloadBannerProps) => {
  const { t } = useTranslation();
  const chrome = useQuranChromeColors();
  const reduceMotion = useReducedMotion();
  const versionDownloads = useQuranStore((s) => s.versionDownloads);
  const selectedVersion = useQuranStore((s) => s.selectedVersion);

  // A background download of some other edition (the selected one shows the
  // full progress screen, not this banner).
  const downloading = Object.entries(versionDownloads).find(
    ([v, state]) =>
      v !== selectedVersion &&
      (state?.status === DownloadStatus.DOWNLOADING || state?.status === DownloadStatus.PAUSED)
  );
  if (!downloading) return null;

  const [version, state] = downloading;
  const percent = state?.progress?.percent ?? 0;
  const phase = state?.progress?.phase;
  const step = state?.progress?.step ?? DownloadStep.IMAGES;

  // Downloading shows the live percentage for step 1/2; extract/finalize (and
  // all of step 2/2, which carries no byte progress) show the phase name
  // instead, and hold the bar full.
  const statusLabel =
    phase === DownloadPhase.EXTRACTING
      ? t("quran.download.phaseExtracting")
      : phase === DownloadPhase.FINALIZING
        ? t("quran.download.phaseFinalizing")
        : step === DownloadStep.ORNAMENTS
          ? t("quran.download.phaseDownloading")
          : `${percent}%`;
  // The ornament packs (step 2/2) carry no declared size, so the bar holds
  // full rather than showing a stray 0%.
  const barWidth =
    step === DownloadStep.ORNAMENTS || (phase && phase !== DownloadPhase.DOWNLOADING)
      ? 100
      : percent;

  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeInDown.springify().damping(18).stiffness(200)}
      exiting={reduceMotion ? undefined : FadeOutUp.duration(200)}
      style={[
        styles.container,
        { backgroundColor: chrome.cardBackground, borderColor: chrome.cardBorder },
      ]}>
      <XStack alignItems="center" justifyContent="space-between" gap="$2">
        <XStack alignItems="center" gap="$2" flex={1}>
          <Text fontSize={13}>
            {t(`quran.version.${version as MushafVersion}`)} — {t(DOWNLOAD_STEP_LABEL_KEYS[step])} ·{" "}
            {statusLabel}
          </Text>
          <View
            flex={1}
            height={3}
            backgroundColor={chrome.progressTrack}
            borderRadius={2}
            overflow="hidden">
            <View
              height={3}
              width={`${barWidth}%`}
              backgroundColor={chrome.accent}
              borderRadius={2}
            />
          </View>
        </XStack>
        <Pressable
          onPress={onDismiss}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t("common.close")}>
          <X size={14} color={chrome.subtleText} />
        </Pressable>
      </XStack>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
});

export default DownloadBanner;
