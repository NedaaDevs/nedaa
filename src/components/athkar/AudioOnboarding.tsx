import { FC, useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView } from "react-native";
import TrackPlayer, { useProgress, useIsPlaying } from "react-native-track-player";

import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Button } from "@/components/ui/button";
import { Pressable } from "@/components/ui/pressable";
import { Icon } from "@/components/ui/icon";
import { Modal, ModalBackdrop, ModalContent, ModalBody } from "@/components/ui/modal";
import { Headphones, Hand, VolumeX } from "lucide-react-native";

import ReciterCard from "@/components/athkar/ReciterCard";
import DownloadProgress from "@/components/athkar/DownloadProgress";
import { MessageToast } from "@/components/feedback/MessageToast";

import { useAthkarAudioStore } from "@/stores/athkar-audio";
import { athkarPlayer } from "@/services/athkar-player";
import { reciterRegistry } from "@/services/athkar-reciter-registry";
import { audioDownloadManager } from "@/services/athkar-audio-download";
import { PLAYBACK_MODE } from "@/constants/AthkarAudio";

import type { ReciterCatalogEntry, ReciterManifest, PlaybackMode } from "@/types/athkar-audio";

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

const TOTAL_STEPS = 3;

const AudioOnboarding: FC<Props> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();

  const { selectReciter, setPlaybackMode, setOnboardingCompleted } = useAthkarAudioStore();

  const [step, setStep] = useState(1);
  const [reciters, setReciters] = useState<ReciterCatalogEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedMode, setSelectedMode] = useState<PlaybackMode>(PLAYBACK_MODE.AUTOPILOT);
  const [downloadCompleted, setDownloadCompleted] = useState(0);
  const [downloadTotal, setDownloadTotal] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [failedIds, setFailedIds] = useState<string[]>([]);
  const [cachedManifest, setCachedManifest] = useState<ReciterManifest | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  // Sample player via TrackPlayer
  const { position, duration } = useProgress();
  const { playing } = useIsPlaying();
  const [playingSampleId, setPlayingSampleId] = useState<string | null>(null);
  const playingSampleIdRef = useRef<string | null>(null);
  const sampleProgress = duration > 0 ? position / duration : 0;

  // Keep ref in sync for use in non-reactive callbacks
  useEffect(() => {
    playingSampleIdRef.current = playingSampleId;
  }, [playingSampleId]);

  // Detect sample completion via status
  useEffect(() => {
    if (playingSampleId && !playing && duration > 0 && position >= duration - 0.1) {
      setPlayingSampleId(null);
    }
  }, [playing, position, duration, playingSampleId]);

  const stopSample = useCallback(() => {
    TrackPlayer.pause().catch(() => {});
    setPlayingSampleId(null);
  }, []);

  const playSample = useCallback(
    async (reciterId: string, url: string) => {
      await athkarPlayer.initialize();
      stopSample();
      try {
        await TrackPlayer.load({ url, title: reciterId });
        await TrackPlayer.play();
        setPlayingSampleId(reciterId);
      } catch {}
    },
    [stopSample]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (playingSampleIdRef.current) {
        TrackPlayer.pause().catch(() => {});
      }
    };
  }, []);

  // Stop sample when closing or selecting a different reciter
  useEffect(() => {
    if (!isOpen) stopSample();
  }, [isOpen, stopSample]);

  // Load reciters on open
  useEffect(() => {
    if (!isOpen) return;
    setStep(1);
    setSelectedId(null);
    setSelectedMode(PLAYBACK_MODE.AUTOPILOT);
    setDownloadCompleted(0);
    setDownloadTotal(0);
    setIsDownloading(false);
    setFailedIds([]);
    setCachedManifest(null);
    setIsRetrying(false);

    const loadReciters = async () => {
      const catalog = await reciterRegistry.fetchCatalog();
      if (catalog?.reciters) {
        setReciters(catalog.reciters);
        const defaultReciter = catalog.reciters.find((r) => r.isDefault) ?? catalog.reciters[0];
        if (defaultReciter) {
          setSelectedId(defaultReciter.id);
        }
      }
    };
    loadReciters();
  }, [isOpen]);

  const handleSkip = () => {
    // Apply smart defaults
    if (selectedId) selectReciter(selectedId);
    setPlaybackMode(PLAYBACK_MODE.AUTOPILOT);
    setOnboardingCompleted(true);
    onClose();
  };

  const handleNext = async () => {
    if (step === 1) {
      if (selectedId) {
        selectReciter(selectedId);
        // Start downloading in background
        startDownload(selectedId);
      }
      setStep(2);
    } else if (step === 2) {
      setPlaybackMode(selectedMode);
      setStep(3);
    } else if (step === 3) {
      setOnboardingCompleted(true);
      onClose();
    }
  };

  const startDownload = async (reciterId: string) => {
    const reciter = reciters.find((r) => r.id === reciterId);
    if (!reciter) return;

    setIsDownloading(true);
    setFailedIds([]);

    const manifest = await reciterRegistry.fetchManifest(reciterId);
    if (!manifest) {
      setIsDownloading(false);
      return;
    }

    setCachedManifest(manifest);
    const total = Object.keys(manifest.files).length;
    setDownloadTotal(total);

    const result = await audioDownloadManager.downloadPack(
      reciterId,
      manifest,
      (completed, _total) => {
        setDownloadCompleted(completed);
      }
    );

    if (result.failed > 0) {
      setFailedIds(result.failedIds);
      MessageToast.showWarning(t("athkar.audio.downloadFailed", { count: result.failed }));
    }

    setIsDownloading(false);
  };

  const handleRetryFailed = async () => {
    if (!selectedId || !cachedManifest || failedIds.length === 0) return;

    setIsRetrying(true);
    setDownloadTotal(failedIds.length);
    setDownloadCompleted(0);

    const result = await audioDownloadManager.retryFailed(
      selectedId,
      cachedManifest,
      failedIds,
      (completed) => {
        setDownloadCompleted(completed);
      }
    );

    if (result.failed > 0) {
      setFailedIds(result.failedIds);
      MessageToast.showWarning(t("athkar.audio.downloadFailed", { count: result.failed }));
    } else {
      setFailedIds([]);
      MessageToast.showSuccess(t("athkar.audio.downloadRetrySuccess"));
    }

    setIsRetrying(false);
  };

  const modeOptions = [
    {
      mode: PLAYBACK_MODE.AUTOPILOT as PlaybackMode,
      icon: Headphones,
      titleKey: "athkar.onboarding.mode.autopilot.title",
      descKey: "athkar.onboarding.mode.autopilot.description",
    },
    {
      mode: PLAYBACK_MODE.MANUAL as PlaybackMode,
      icon: Hand,
      titleKey: "athkar.onboarding.mode.manual.title",
      descKey: "athkar.onboarding.mode.manual.description",
    },
    {
      mode: PLAYBACK_MODE.OFF as PlaybackMode,
      icon: VolumeX,
      titleKey: "athkar.onboarding.mode.off.title",
      descKey: "athkar.onboarding.mode.off.description",
    },
  ];

  return (
    <Modal isOpen={isOpen} onClose={handleSkip} size="lg">
      <ModalBackdrop />
      <ModalContent>
        <ModalBody>
          <VStack gap="$4" paddingVertical="$2">
            {/* Progress dots */}
            <HStack justifyContent="center" gap="$2">
              {Array.from({ length: TOTAL_STEPS }, (_, i) => (
                <Box
                  key={i}
                  width={step === i + 1 ? 24 : 8}
                  height={8}
                  borderRadius={4}
                  backgroundColor={
                    i + 1 < step ? "$success" : i + 1 === step ? "$primary" : "$outline"
                  }
                />
              ))}
            </HStack>

            {/* Step 1: Reciter pick */}
            {step === 1 && (
              <VStack gap="$4">
                <VStack gap="$2" alignItems="center">
                  <Text size="xl" fontWeight="600" color="$typography" textAlign="center">
                    {t("athkar.onboarding.welcome.title")}
                  </Text>
                  <Text size="sm" color="$typographySecondary" textAlign="center">
                    {t("athkar.onboarding.welcome.description")}
                  </Text>
                </VStack>

                <ScrollView style={{ maxHeight: 300 }}>
                  <VStack gap="$2">
                    {reciters.map((reciter) => (
                      <ReciterCard
                        key={reciter.id}
                        reciter={reciter}
                        selected={selectedId === reciter.id}
                        isDownloading={isDownloading && selectedId === reciter.id}
                        onSelect={(id) => {
                          stopSample();
                          setSelectedId(id);
                        }}
                        onPlaySample={(url) => playSample(reciter.id, url)}
                        onStopSample={stopSample}
                        isSamplePlaying={playingSampleId === reciter.id}
                        sampleProgress={playingSampleId === reciter.id ? sampleProgress : undefined}
                      />
                    ))}
                  </VStack>
                </ScrollView>
              </VStack>
            )}

            {/* Step 2: Mode pick */}
            {step === 2 && (
              <VStack gap="$4">
                <VStack gap="$2" alignItems="center">
                  <Text size="xl" fontWeight="600" color="$typography" textAlign="center">
                    {t("athkar.onboarding.mode.title")}
                  </Text>
                  <Text size="sm" color="$typographySecondary" textAlign="center">
                    {t("athkar.onboarding.mode.description")}
                  </Text>
                </VStack>

                <VStack gap="$2">
                  {modeOptions.map((option) => (
                    <Pressable key={option.mode} onPress={() => setSelectedMode(option.mode)}>
                      <Box
                        padding="$3"
                        borderRadius="$6"
                        backgroundColor={
                          selectedMode === option.mode ? "$primary" : "$backgroundSecondary"
                        }
                        borderWidth={1}
                        borderColor={selectedMode === option.mode ? "$primary" : "$outline"}>
                        <HStack alignItems="center" gap="$3">
                          <Box
                            width={44}
                            height={44}
                            borderRadius={22}
                            backgroundColor={
                              selectedMode === option.mode
                                ? "$backgroundSecondary"
                                : "$backgroundMuted"
                            }
                            alignItems="center"
                            justifyContent="center">
                            <Icon
                              as={option.icon}
                              size="md"
                              color={selectedMode === option.mode ? "$primary" : "$typography"}
                            />
                          </Box>
                          <VStack flex={1}>
                            <Text
                              fontWeight="600"
                              color={
                                selectedMode === option.mode ? "$typographyContrast" : "$typography"
                              }>
                              {t(option.titleKey)}
                            </Text>
                            <Text
                              size="sm"
                              color={
                                selectedMode === option.mode
                                  ? "$typographyContrast"
                                  : "$typographySecondary"
                              }>
                              {t(option.descKey)}
                            </Text>
                          </VStack>
                        </HStack>
                      </Box>
                    </Pressable>
                  ))}
                </VStack>
              </VStack>
            )}

            {/* Step 3: Download progress */}
            {step === 3 && (
              <VStack gap="$4">
                <VStack gap="$2" alignItems="center">
                  <Text size="xl" fontWeight="600" color="$typography" textAlign="center">
                    {t("athkar.onboarding.download.title")}
                  </Text>
                  <Text size="sm" color="$typographySecondary" textAlign="center">
                    {t("athkar.onboarding.download.description")}
                  </Text>
                </VStack>

                {downloadTotal > 0 && !isRetrying && (
                  <DownloadProgress completed={downloadCompleted} total={downloadTotal} />
                )}

                {isRetrying && (
                  <DownloadProgress
                    completed={downloadCompleted}
                    total={downloadTotal}
                    label={t("athkar.audio.retrying")}
                  />
                )}

                {!isDownloading && !isRetrying && failedIds.length > 0 && (
                  <Button size="sm" variant="outline" onPress={handleRetryFailed}>
                    <Button.Text color="$primary">
                      {t("athkar.audio.retry")} ({failedIds.length})
                    </Button.Text>
                  </Button>
                )}

                {!isDownloading &&
                  !isRetrying &&
                  failedIds.length === 0 &&
                  downloadCompleted === downloadTotal &&
                  downloadTotal > 0 && (
                    <Text size="sm" color="$success" textAlign="center" fontWeight="500">
                      {t("athkar.onboarding.download.complete")}
                    </Text>
                  )}
              </VStack>
            )}

            {/* Action buttons */}
            <VStack gap="$2">
              <Button
                size="lg"
                variant="solid"
                borderRadius={999}
                backgroundColor="$primary"
                onPress={handleNext}>
                <Button.Text fontWeight="600" color="$typographyContrast">
                  {step === TOTAL_STEPS ? t("athkar.onboarding.done") : t("athkar.onboarding.next")}
                </Button.Text>
              </Button>

              <Pressable
                onPress={handleSkip}
                minHeight={44}
                justifyContent="center"
                alignItems="center">
                <Text size="sm" color="$typographySecondary">
                  {t("athkar.onboarding.skip")}
                </Text>
              </Pressable>
            </VStack>
          </VStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default AudioOnboarding;
