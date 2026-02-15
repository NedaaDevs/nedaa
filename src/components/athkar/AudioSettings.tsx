import { FC, useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Alert, ScrollView } from "react-native";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";

import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Switch } from "@/components/ui/switch";
import { Divider } from "@/components/ui/divider";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Trash2, Check } from "lucide-react-native";

import ReciterCard from "@/components/athkar/ReciterCard";
import DownloadProgress from "@/components/athkar/DownloadProgress";
import AudioOnboarding from "@/components/athkar/AudioOnboarding";
import { MessageToast } from "@/components/feedback/MessageToast";

import { useAthkarAudioStore } from "@/stores/athkar-audio";
import { reciterRegistry } from "@/services/athkar-reciter-registry";
import { audioDownloadManager } from "@/services/athkar-audio-download";
import { AthkarDB } from "@/services/athkar-db";
import { formatFileSize } from "@/utils/customSoundManager";
import { PLAYBACK_MODE } from "@/constants/AthkarAudio";

import type { ReciterCatalogEntry, ReciterManifest, PlaybackMode } from "@/types/athkar-audio";

const AudioSettings: FC = () => {
  const { t, i18n } = useTranslation();

  const {
    playbackMode,
    selectedReciterId,
    comfortMode,
    setPlaybackMode,
    selectReciter,
    toggleComfortMode,
    setOnboardingCompleted,
  } = useAthkarAudioStore();

  const [reciters, setReciters] = useState<ReciterCatalogEntry[]>([]);
  const [storageBreakdown, setStorageBreakdown] = useState<{ reciterId: string; size: number }[]>(
    []
  );
  const [totalStorage, setTotalStorage] = useState(0);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadCompleted, setDownloadCompleted] = useState(0);
  const [downloadTotal, setDownloadTotal] = useState(0);
  const [failedIds, setFailedIds] = useState<string[]>([]);
  const [cachedManifest, setCachedManifest] = useState<ReciterManifest | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  // Sample player
  const samplePlayer = useAudioPlayer();
  const sampleStatus = useAudioPlayerStatus(samplePlayer);
  const [playingSampleId, setPlayingSampleId] = useState<string | null>(null);
  const sampleProgress =
    sampleStatus.duration > 0 ? sampleStatus.currentTime / sampleStatus.duration : 0;

  // Detect sample completion via status
  useEffect(() => {
    if (
      playingSampleId &&
      !sampleStatus.playing &&
      sampleStatus.duration > 0 &&
      sampleStatus.currentTime >= sampleStatus.duration - 0.1
    ) {
      setPlayingSampleId(null);
    }
  }, [sampleStatus, playingSampleId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      try {
        samplePlayer.pause();
      } catch {}
    };
  }, [samplePlayer]);

  const stopSample = useCallback(() => {
    try {
      samplePlayer.pause();
    } catch {}
    setPlayingSampleId(null);
  }, [samplePlayer]);

  const playSample = useCallback(
    async (reciterId: string, url: string) => {
      stopSample();
      try {
        await samplePlayer.replace({ uri: url });
        await samplePlayer.play();
        setPlayingSampleId(reciterId);
      } catch {}
    },
    [samplePlayer, stopSample]
  );

  const refreshStorage = useCallback(async () => {
    const breakdown = await audioDownloadManager.getStorageBreakdown();
    setStorageBreakdown(breakdown);
    const total = await AthkarDB.getAudioStorageUsed();
    setTotalStorage(total);
  }, []);

  const loadData = useCallback(async () => {
    const catalog = await reciterRegistry.fetchCatalog();
    if (catalog?.reciters) {
      setReciters(catalog.reciters);
    }
    await refreshStorage();
  }, [refreshStorage]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDeletePack = (reciterId: string) => {
    Alert.alert(
      t("settings.athkarAudio.deleteConfirm.title"),
      t("settings.athkarAudio.deleteConfirm.message"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: async () => {
            await audioDownloadManager.deleteReciterPack(reciterId);
            await refreshStorage();
          },
        },
      ]
    );
  };

  const handleDownloadPack = async (reciterId: string) => {
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
    setDownloadCompleted(0);

    const result = await audioDownloadManager.downloadPack(reciterId, manifest, (completed) => {
      setDownloadCompleted(completed);
    });

    if (result.failed > 0) {
      setFailedIds(result.failedIds);
      MessageToast.showWarning(t("athkar.audio.downloadFailed", { count: result.failed }));
    }

    setIsDownloading(false);
    await refreshStorage();
  };

  const handleRetryFailed = async () => {
    if (!selectedReciterId || !cachedManifest || failedIds.length === 0) return;

    setIsRetrying(true);
    setDownloadTotal(failedIds.length);
    setDownloadCompleted(0);

    const result = await audioDownloadManager.retryFailed(
      selectedReciterId,
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
    await refreshStorage();
  };

  const modeOptions: { mode: PlaybackMode; labelKey: string; descKey: string }[] = [
    {
      mode: PLAYBACK_MODE.AUTOPILOT as PlaybackMode,
      labelKey: "settings.athkarAudio.mode.autopilot",
      descKey: "settings.athkarAudio.mode.autopilotDesc",
    },
    {
      mode: PLAYBACK_MODE.MANUAL as PlaybackMode,
      labelKey: "settings.athkarAudio.mode.manual",
      descKey: "settings.athkarAudio.mode.manualDesc",
    },
    {
      mode: PLAYBACK_MODE.OFF as PlaybackMode,
      labelKey: "settings.athkarAudio.mode.off",
      descKey: "settings.athkarAudio.mode.offDesc",
    },
  ];

  return (
    <>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}>
        <VStack padding="$4" gap="$4">
          {/* Reciter Section */}
          <VStack gap="$3">
            <Text size="sm" fontWeight="600" color="$typographySecondary">
              {t("settings.athkarAudio.reciter")}
            </Text>
            {reciters.map((reciter) => {
              const isSelected = selectedReciterId === reciter.id;
              const hasDownload = storageBreakdown.some((s) => s.reciterId === reciter.id);
              return (
                <VStack key={reciter.id} gap="$2">
                  <ReciterCard
                    reciter={reciter}
                    selected={isSelected}
                    downloaded={hasDownload}
                    isDownloading={isSelected && isDownloading}
                    onSelect={(id) => {
                      if (isDownloading) return;
                      stopSample();
                      selectReciter(id);
                      if (!hasDownload) {
                        handleDownloadPack(id);
                      }
                    }}
                    onPlaySample={(url) => playSample(reciter.id, url)}
                    onStopSample={stopSample}
                    isSamplePlaying={playingSampleId === reciter.id}
                    sampleProgress={playingSampleId === reciter.id ? sampleProgress : undefined}
                  />
                  {isSelected && !hasDownload && isDownloading && (
                    <DownloadProgress completed={downloadCompleted} total={downloadTotal} />
                  )}
                  {isSelected && isRetrying && (
                    <DownloadProgress
                      completed={downloadCompleted}
                      total={downloadTotal}
                      label={t("athkar.audio.retrying")}
                    />
                  )}
                  {isSelected && !isDownloading && !isRetrying && failedIds.length > 0 && (
                    <Button size="sm" variant="outline" onPress={handleRetryFailed}>
                      <Button.Text color="$primary">
                        {t("athkar.audio.retry")} ({failedIds.length})
                      </Button.Text>
                    </Button>
                  )}
                </VStack>
              );
            })}
          </VStack>

          <Divider />

          {/* Playback Mode */}
          <VStack gap="$3">
            <Text size="sm" fontWeight="600" color="$typographySecondary">
              {t("settings.athkarAudio.playbackMode")}
            </Text>
            {modeOptions.map((option) => (
              <Pressable key={option.mode} onPress={() => setPlaybackMode(option.mode)}>
                <Box
                  padding="$3"
                  borderRadius="$6"
                  backgroundColor={
                    playbackMode === option.mode ? "$primary" : "$backgroundSecondary"
                  }>
                  <HStack alignItems="center" justifyContent="space-between">
                    <VStack flex={1}>
                      <Text
                        fontWeight="500"
                        color={
                          playbackMode === option.mode ? "$typographyContrast" : "$typography"
                        }>
                        {t(option.labelKey)}
                      </Text>
                      <Text
                        size="sm"
                        color={
                          playbackMode === option.mode
                            ? "$typographyContrast"
                            : "$typographySecondary"
                        }>
                        {t(option.descKey)}
                      </Text>
                    </VStack>
                    {playbackMode === option.mode && (
                      <Icon as={Check} size="md" color="$typographyContrast" />
                    )}
                  </HStack>
                </Box>
              </Pressable>
            ))}
          </VStack>

          <Divider />

          {/* Accessibility */}
          <VStack gap="$3">
            <Text size="sm" fontWeight="600" color="$typographySecondary">
              {t("settings.athkarAudio.accessibility")}
            </Text>
            <Box backgroundColor="$backgroundSecondary" borderRadius="$6" padding="$4">
              <HStack justifyContent="space-between" alignItems="center">
                <VStack flex={1} marginEnd="$4">
                  <Text fontWeight="500" color="$typography">
                    {t("settings.athkarAudio.comfortMode")}
                  </Text>
                  <Text size="sm" color="$typographySecondary" marginTop="$1">
                    {t("settings.athkarAudio.comfortModeDesc")}
                  </Text>
                </VStack>
                <Switch value={comfortMode} onValueChange={toggleComfortMode} />
              </HStack>
            </Box>
          </VStack>

          <Divider />

          {/* Storage */}
          <VStack gap="$3">
            <Text size="sm" fontWeight="600" color="$typographySecondary">
              {t("settings.athkarAudio.storage")}
            </Text>
            <Box backgroundColor="$backgroundSecondary" borderRadius="$6" padding="$4">
              <VStack gap="$3">
                {storageBreakdown.length === 0 ? (
                  <Text size="sm" color="$typographySecondary">
                    {t("settings.athkarAudio.noDownloads")}
                  </Text>
                ) : (
                  storageBreakdown.map((item) => {
                    const reciter = reciters.find((r) => r.id === item.reciterId);
                    return (
                      <HStack
                        key={item.reciterId}
                        justifyContent="space-between"
                        alignItems="center">
                        <Text color="$typography">
                          {reciter
                            ? reciterRegistry.getLocalizedName(reciter.name, i18n.language)
                            : item.reciterId}
                        </Text>
                        <HStack alignItems="center" gap="$2">
                          <Text size="sm" color="$typographySecondary">
                            {formatFileSize(item.size)}
                          </Text>
                          <Pressable
                            onPress={() => handleDeletePack(item.reciterId)}
                            width={36}
                            height={36}
                            borderRadius={18}
                            alignItems="center"
                            justifyContent="center">
                            <Icon as={Trash2} size="sm" color="$error" />
                          </Pressable>
                        </HStack>
                      </HStack>
                    );
                  })
                )}
                {totalStorage > 0 && (
                  <>
                    <Divider />
                    <HStack justifyContent="space-between" alignItems="center">
                      <Text fontWeight="500" color="$typography">
                        {t("settings.athkarAudio.totalStorage")}
                      </Text>
                      <Text fontWeight="500" color="$typography">
                        {formatFileSize(totalStorage)}
                      </Text>
                    </HStack>
                  </>
                )}
              </VStack>
            </Box>
          </VStack>

          <Divider />

          {/* Re-run Walkthrough */}
          <Button
            variant="outline"
            size="md"
            onPress={() => {
              setOnboardingCompleted(false);
              setShowOnboarding(true);
            }}>
            <Button.Text color="$primary">{t("settings.athkarAudio.rerunWalkthrough")}</Button.Text>
          </Button>
        </VStack>
      </ScrollView>

      <AudioOnboarding isOpen={showOnboarding} onClose={() => setShowOnboarding(false)} />
    </>
  );
};

export default AudioSettings;
