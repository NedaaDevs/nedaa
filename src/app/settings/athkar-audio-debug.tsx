import { useState, useCallback } from "react";
import { ScrollView } from "react-native";
import { useTranslation } from "react-i18next";

import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import TopBar from "@/components/TopBar";
import { Background } from "@/components/ui/background";

import { useAthkarStore } from "@/stores/athkar";
import { useAthkarAudioStore } from "@/stores/athkar-audio";
import { audioDownloadManager } from "@/services/athkar-audio-download";
import { AthkarDB } from "@/services/athkar-db";
import { formatFileSize } from "@/utils/customSoundManager";
import { AppLogger } from "@/utils/appLogger";

const log = AppLogger.create("athkar-audio");

const AthkarAudioDebugScreen = () => {
  const { t } = useTranslation();

  const { playerState, currentThikrId, repeatProgress, sessionProgress } = useAthkarStore();
  const { playbackMode, selectedReciterId } = useAthkarAudioStore();

  const morningAthkarList = useAthkarStore((s) => s.morningAthkarList);
  const eveningAthkarList = useAthkarStore((s) => s.eveningAthkarList);

  const [logText, setLogText] = useState("");
  const [storageBreakdown, setStorageBreakdown] = useState<{ reciterId: string; size: number }[]>(
    []
  );
  const [totalStorage, setTotalStorage] = useState(0);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [raceProbeResult, setRaceProbeResult] = useState<string | null>(null);
  const [raceProbeRunning, setRaceProbeRunning] = useState(false);

  const refresh = useCallback(async () => {
    const text = await log.getLogText();
    const lines = text.split("\n");
    const last100 = lines.slice(-100).join("\n");
    setLogText(last100);

    const breakdown = await audioDownloadManager.getStorageBreakdown();
    setStorageBreakdown(breakdown);
    const total = await AthkarDB.getAudioStorageUsed();
    setTotalStorage(total);
    setLastAction(t("settings.athkarAudio.debug.refreshed"));
  }, [t]);

  const handleShare = async () => {
    await log.shareLog();
    setLastAction(t("settings.athkarAudio.debug.shared"));
  };

  const handleClear = async () => {
    await log.clear();
    setLogText("");
    setLastAction(t("settings.athkarAudio.debug.logCleared"));
  };

  // Runs the daily-init race-fix probe: seeds a partial 3-row state on a
  // synthetic far-future date, invokes the public initializeDailyItems, and
  // reports whether the self-heal back-filled to the expected total.
  const handleVerifyRaceFix = useCallback(async () => {
    setRaceProbeRunning(true);
    setRaceProbeResult(null);
    try {
      const morning = morningAthkarList.map((a) => ({
        id: a.id,
        order: a.order,
        count: a.count,
        type: a.type,
      }));
      const evening = eveningAthkarList.map((a) => ({
        id: a.id,
        order: a.order,
        count: a.count,
        type: a.type,
      }));

      if (morning.length === 0 || evening.length === 0) {
        setRaceProbeResult("skipped: athkar lists not loaded yet (open the athkar tab first)");
        return;
      }

      const result = await AthkarDB.verifyDailyInitRecovery(morning, evening);
      setRaceProbeResult(`${result.passed ? "PASS" : "FAIL"} — ${result.message}`);
    } catch (err) {
      setRaceProbeResult(`error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setRaceProbeRunning(false);
    }
  }, [morningAthkarList, eveningAthkarList]);

  return (
    <Background>
      <TopBar title="settings.athkarAudio.debug.title" backOnClick />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}>
        <VStack padding="$4" gap="$4">
          {/* Audio Status */}
          <Card padding="$4">
            <VStack gap="$3">
              <Text size="lg" fontWeight="600" color="$typography">
                {t("settings.athkarAudio.debug.audioStatus")}
              </Text>

              <HStack justifyContent="space-between" alignItems="center">
                <Text color="$typography">{t("settings.athkarAudio.debug.playbackMode")}</Text>
                <Badge action="info">
                  <Badge.Text>{playbackMode}</Badge.Text>
                </Badge>
              </HStack>

              <HStack justifyContent="space-between" alignItems="center">
                <Text color="$typography">{t("settings.athkarAudio.debug.playerState")}</Text>
                <Badge
                  action={
                    playerState === "playing"
                      ? "success"
                      : playerState === "loading"
                        ? "warning"
                        : "muted"
                  }>
                  <Badge.Text>{playerState}</Badge.Text>
                </Badge>
              </HStack>

              <HStack justifyContent="space-between" alignItems="center">
                <Text color="$typography">{t("settings.athkarAudio.debug.reciter")}</Text>
                <Badge action="info">
                  <Badge.Text>{selectedReciterId ?? "none"}</Badge.Text>
                </Badge>
              </HStack>

              <HStack justifyContent="space-between" alignItems="center">
                <Text color="$typography">{t("settings.athkarAudio.debug.queueLength")}</Text>
                <Badge action="info">
                  <Badge.Text>{sessionProgress.total}</Badge.Text>
                </Badge>
              </HStack>
            </VStack>
          </Card>

          {/* Session */}
          <Card padding="$4">
            <VStack gap="$3">
              <Text size="lg" fontWeight="600" color="$typography">
                {t("settings.athkarAudio.debug.session")}
              </Text>

              <HStack justifyContent="space-between" alignItems="center">
                <Text color="$typography">Thikr ID</Text>
                <Text size="sm" color="$typographySecondary" fontFamily="$mono">
                  {currentThikrId ?? "none"}
                </Text>
              </HStack>

              <HStack justifyContent="space-between" alignItems="center">
                <Text color="$typography">Repeat</Text>
                <Badge action="info">
                  <Badge.Text>
                    {repeatProgress.current} / {repeatProgress.total}
                  </Badge.Text>
                </Badge>
              </HStack>

              <HStack justifyContent="space-between" alignItems="center">
                <Text color="$typography">Progress</Text>
                <Badge action="info">
                  <Badge.Text>
                    {sessionProgress.current} / {sessionProgress.total}
                  </Badge.Text>
                </Badge>
              </HStack>
            </VStack>
          </Card>

          {/* Storage */}
          <Card padding="$4">
            <VStack gap="$3">
              <Text size="lg" fontWeight="600" color="$typography">
                {t("settings.athkarAudio.storage")}
              </Text>

              {storageBreakdown.length === 0 ? (
                <Text size="sm" color="$typographySecondary">
                  {t("settings.athkarAudio.debug.noData")}
                </Text>
              ) : (
                storageBreakdown.map((item) => (
                  <HStack key={item.reciterId} justifyContent="space-between" alignItems="center">
                    <Text size="sm" color="$typography" fontFamily="$mono">
                      {item.reciterId}
                    </Text>
                    <Text size="sm" color="$typographySecondary">
                      {formatFileSize(item.size)}
                    </Text>
                  </HStack>
                ))
              )}

              {totalStorage > 0 && (
                <HStack justifyContent="space-between" alignItems="center">
                  <Text fontWeight="500" color="$typography">
                    {t("settings.athkarAudio.totalStorage")}
                  </Text>
                  <Text fontWeight="500" color="$typography">
                    {formatFileSize(totalStorage)}
                  </Text>
                </HStack>
              )}
            </VStack>
          </Card>

          {/* Daily-init race-fix probe (dev-only). Seeds a partial 3-row state
              on a synthetic future date, runs initializeDailyItems, asserts
              back-fill brought it to the expected total, cleans up. */}
          <Card padding="$4">
            <VStack gap="$3">
              <Text size="lg" fontWeight="600" color="$typography">
                Daily-init race fix
              </Text>
              <Text size="sm" color="$typographySecondary">
                Verifies the self-heal back-fill against the real expo-sqlite driver. Uses a
                synthetic date — no real data is touched.
              </Text>
              <Button
                variant="solid"
                onPress={handleVerifyRaceFix}
                disabled={raceProbeRunning}
                accessibilityLabel="Run daily-init race-fix self-heal probe">
                <Button.Text>{raceProbeRunning ? "Running…" : "Run self-heal probe"}</Button.Text>
              </Button>
              {raceProbeResult && (
                <Badge action={raceProbeResult.startsWith("PASS") ? "success" : "error"}>
                  <Badge.Text>{raceProbeResult}</Badge.Text>
                </Badge>
              )}
            </VStack>
          </Card>

          {/* Log */}
          <Card padding="$4">
            <VStack gap="$3">
              <HStack justifyContent="space-between" alignItems="center">
                <Text size="lg" fontWeight="600" color="$typography">
                  {t("settings.athkarAudio.debug.log")}
                </Text>
                <Badge action="info">
                  <Badge.Text>
                    {logText ? logText.split("\n").filter((l) => l.trim()).length : 0} lines
                  </Badge.Text>
                </Badge>
              </HStack>

              {logText ? (
                <ScrollView
                  style={{
                    height: 250,
                    backgroundColor: "rgba(0,0,0,0.05)",
                    borderRadius: 8,
                    padding: 8,
                  }}
                  nestedScrollEnabled>
                  <Text size="xs" fontFamily="$mono" color="$typographySecondary">
                    {logText}
                  </Text>
                </ScrollView>
              ) : (
                <Text size="sm" color="$typographySecondary" fontStyle="italic">
                  {t("settings.athkarAudio.debug.noLogs")}
                </Text>
              )}
            </VStack>
          </Card>

          {/* Actions */}
          <HStack gap="$2">
            <Button variant="solid" flex={1} onPress={handleShare}>
              <Button.Text>{t("settings.athkarAudio.debug.share")}</Button.Text>
            </Button>
            <Button variant="outline" flex={1} onPress={handleClear}>
              <Button.Text>{t("settings.athkarAudio.debug.clear")}</Button.Text>
            </Button>
            <Button variant="outline" flex={1} onPress={refresh}>
              <Button.Text>{t("settings.athkarAudio.debug.refresh")}</Button.Text>
            </Button>
          </HStack>

          {/* Last Action */}
          {lastAction && (
            <Text size="sm" color="$typographySecondary" textAlign="center">
              {lastAction}
            </Text>
          )}
        </VStack>
      </ScrollView>
    </Background>
  );
};

export default AthkarAudioDebugScreen;
