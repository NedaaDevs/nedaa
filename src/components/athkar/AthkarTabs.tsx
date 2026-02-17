import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView } from "react-native";
import { useRouter } from "expo-router";

// Components
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Fab, FabIcon } from "@/components/ui/fab";
import { Icon } from "@/components/ui/icon";

import AthkarList from "@/components/athkar/AthkarList";
import MiniPlayer from "@/components/athkar/MiniPlayer";
import AudioOnboarding from "@/components/athkar/AudioOnboarding";

// Stores
import { useAthkarStore } from "@/stores/athkar";
import { useAthkarAudioStore } from "@/stores/athkar-audio";

// Hooks
import { useInitializeAthkar } from "@/hooks/useInitializeAthkar";
import { useAthkarAudioBridge } from "@/hooks/useAthkarAudioBridge";

// Constants
import { ATHKAR_TYPE } from "@/constants/Athkar";
import { PLAYBACK_MODE, AUDIO_UI } from "@/constants/AthkarAudio";

// Icons
import { Sun, Moon, Focus } from "lucide-react-native";

// Types
import { AthkarType } from "@/types/athkar";

// Utils
import { getCurrentAthkarPeriod } from "@/utils/athkar";

// Services
import { athkarPlayer } from "@/services/athkar-player";
import { reciterRegistry } from "@/services/athkar-reciter-registry";

const AthkarTabs = () => {
  const { t } = useTranslation();
  const router = useRouter();

  const { morningAthkarList, eveningAthkarList, setCurrentType, validateDailyStreak } =
    useAthkarStore();
  const audioStop = useAthkarAudioStore((s) => s.stop);
  const playerState = useAthkarAudioStore((s) => s.playerState);
  const playbackMode = useAthkarAudioStore((s) => s.playbackMode);
  const selectedReciterId = useAthkarAudioStore((s) => s.selectedReciterId);
  const comfortMode = useAthkarAudioStore((s) => s.comfortMode);

  const isPlayerActive =
    playerState === "playing" ||
    playerState === "paused" ||
    playerState === "loading" ||
    playerState === "advancing";
  const miniPlayerHeight = comfortMode
    ? AUDIO_UI.MINI_PLAYER_HEIGHT_COMFORT
    : AUDIO_UI.MINI_PLAYER_HEIGHT;

  const [showOnboarding, setShowOnboarding] = useState(false);

  type activeTabType = Exclude<AthkarType, "all">;

  const [activeTab, setActiveTab] = useState<activeTabType>(() => {
    return getCurrentAthkarPeriod();
  });

  // Initialize athkar data
  useInitializeAthkar();

  // Mount audio bridge for background playback
  useAthkarAudioBridge();

  // Check for daily reset and validate streak on mount
  useEffect(() => {
    setCurrentType(activeTab);
    validateDailyStreak();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Build audio queue so play buttons in the list work
  const showAudioControls = playbackMode !== PLAYBACK_MODE.OFF;
  const currentAthkarList =
    activeTab === ATHKAR_TYPE.MORNING ? morningAthkarList : eveningAthkarList;

  useEffect(() => {
    if (!showAudioControls || !selectedReciterId || currentAthkarList.length === 0) return;

    const buildQueue = async () => {
      const catalog = await reciterRegistry.fetchCatalog();
      const reciter = catalog?.reciters.find((r) => r.id === selectedReciterId);
      if (!reciter) return;

      const manifest = await reciterRegistry.fetchManifest(selectedReciterId);
      if (!manifest) return;

      athkarPlayer.setMode(playbackMode);
      athkarPlayer.setRepeatLimit(useAthkarAudioStore.getState().repeatLimit);
      athkarPlayer.buildQueue(currentAthkarList, manifest, selectedReciterId, activeTab);
    };

    buildQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAudioControls, selectedReciterId, activeTab, currentAthkarList.length]);

  const handleRequestOnboarding = useCallback(() => {
    setShowOnboarding(true);
  }, []);

  return (
    <Box flex={1}>
      {/* Tab Header */}
      <Box backgroundColor="$background">
        <HStack justifyContent="center" alignItems="center" paddingVertical="$2">
          {/* Morning Tab */}
          <Pressable
            onPress={() => {
              if (activeTab !== ATHKAR_TYPE.MORNING && playerState !== "idle") {
                audioStop();
              }
              setActiveTab(ATHKAR_TYPE.MORNING);
              setCurrentType(ATHKAR_TYPE.MORNING);
            }}
            role="tab"
            accessibilityLabel={t("athkar.morning")}
            flex={1}
            minHeight={44}
            paddingVertical="$3"
            paddingHorizontal="$4"
            marginHorizontal="$2"
            borderRadius={999}
            alignItems="center"
            justifyContent="center"
            backgroundColor={
              activeTab === ATHKAR_TYPE.MORNING ? "$primary" : "$backgroundSecondary"
            }>
            <HStack gap="$2" alignItems="center">
              <Icon
                as={Sun}
                size="md"
                color={
                  activeTab === ATHKAR_TYPE.MORNING ? "$typographyContrast" : "$typographySecondary"
                }
              />
              <Text
                fontWeight="500"
                color={
                  activeTab === ATHKAR_TYPE.MORNING ? "$typographyContrast" : "$typographySecondary"
                }>
                {t("athkar.morning")}
              </Text>
            </HStack>
          </Pressable>

          {/* Evening Tab */}
          <Pressable
            onPress={() => {
              if (activeTab !== ATHKAR_TYPE.EVENING && playerState !== "idle") {
                audioStop();
              }
              setActiveTab(ATHKAR_TYPE.EVENING);
              setCurrentType(ATHKAR_TYPE.EVENING);
            }}
            role="tab"
            accessibilityLabel={t("athkar.evening")}
            flex={1}
            minHeight={44}
            paddingVertical="$3"
            paddingHorizontal="$4"
            marginHorizontal="$2"
            borderRadius={999}
            alignItems="center"
            justifyContent="center"
            backgroundColor={
              activeTab === ATHKAR_TYPE.EVENING ? "$primary" : "$backgroundSecondary"
            }>
            <HStack gap="$2" alignItems="center">
              <Icon
                as={Moon}
                size="md"
                color={
                  activeTab === ATHKAR_TYPE.EVENING ? "$typographyContrast" : "$typographySecondary"
                }
              />
              <Text
                fontWeight="500"
                color={
                  activeTab === ATHKAR_TYPE.EVENING ? "$typographyContrast" : "$typographySecondary"
                }>
                {t("athkar.evening")}
              </Text>
            </HStack>
          </Pressable>
        </HStack>
      </Box>

      {/* Content Area */}
      <ScrollView style={{ flex: 1, backgroundColor: "transparent" }}>
        <Box padding="$4">
          <AthkarList type={activeTab} onRequestOnboarding={handleRequestOnboarding} />
        </Box>
      </ScrollView>

      {/* Mini Player — shows when audio is active */}
      <MiniPlayer />

      <Fab
        onPress={() => router.push("/athkar-focus")}
        size="lg"
        placement="bottom right"
        bottom={isPlayerActive ? 16 + miniPlayerHeight + 8 : 16}
        accessibilityLabel={t("athkar.focus.title")}>
        <FabIcon as={Focus} color="$typographyContrast" />
      </Fab>

      <AudioOnboarding isOpen={showOnboarding} onClose={() => setShowOnboarding(false)} />
    </Box>
  );
};

export default AthkarTabs;
