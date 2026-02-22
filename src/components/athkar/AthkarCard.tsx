import { FC } from "react";
import { useTranslation } from "react-i18next";
// Components
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Progress, ProgressFilledTrack } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

// Icons
import { Check, Minus, Play, Pause } from "lucide-react-native";

// Stores
import { useAthkarStore } from "@/stores/athkar";
import { useAthkarAudioStore } from "@/stores/athkar-audio";

// Types
import { Athkar } from "@/types/athkar";

// Utils
import { formatNumberToLocale } from "@/utils/number";

// Hooks
import { useHaptic } from "@/hooks/useHaptic";

import AthkarTextDisplay from "@/components/athkar/AthkarTextDisplay";
import { PLAYBACK_MODE } from "@/constants/AthkarAudio";
import { athkarPlayer } from "@/services/athkar-player";

type Props = {
  athkar: Athkar;
  progress: {
    current: number;
    total: number;
    completed: boolean;
  };
  onRequestOnboarding?: () => void;
};

const AthkarCard: FC<Props> = ({ athkar, progress, onRequestOnboarding }) => {
  const { t, i18n } = useTranslation();
  const { incrementCount, decrementCount } = useAthkarStore();
  const playbackMode = useAthkarAudioStore((s) => s.playbackMode);
  const onboardingCompleted = useAthkarAudioStore((s) => s.onboardingCompleted);
  const currentAthkarId = useAthkarAudioStore((s) => s.currentAthkarId);
  const playerState = useAthkarAudioStore((s) => s.playerState);
  const showAudioIcon = playbackMode !== PLAYBACK_MODE.OFF;

  const isThisPlaying = currentAthkarId === athkar.id && playerState === "playing";
  const isThisPaused = currentAthkarId === athkar.id && playerState === "paused";

  const hapticSelection = useHaptic("selection");
  const hapticSuccess = useHaptic("success");
  const hapticWarning = useHaptic("warning");

  const isRTL = i18n.dir() === "rtl";

  const { current: currentCount, total, completed: isCompleted } = progress;
  const progressPercentage = (currentCount / total) * 100;

  const isGrouped = !!athkar.group;
  const groupInfo = athkar.group;
  const currentGroupIndex = isGrouped ? currentCount % groupInfo!.itemsPerRound : 0;

  const handleIncrement = () => {
    hapticSelection();
    incrementCount(athkar.id);

    if (isCompleted) {
      hapticSuccess();
      return;
    }

    if (currentCount + 1 === total) {
      hapticSuccess();
    }
  };

  return (
    <Pressable onPress={handleIncrement} disabled={isCompleted}>
      <Box
        padding="$4"
        borderRadius="$6"
        position="relative"
        backgroundColor={isCompleted ? "$backgroundSuccess" : "$backgroundSecondary"}
        borderWidth={isCompleted ? 2 : 0}
        borderColor={isCompleted ? "$success" : "transparent"}>
        <VStack gap="$3">
          {/* Athkar Text */}
          <AthkarTextDisplay
            textKey={athkar.text}
            size="xl"
            textAlign="left"
            color={isCompleted ? "$typographySecondary" : "$typography"}
          />

          {/* Surah label pills for grouped items */}
          {isGrouped && groupInfo && (
            <HStack gap="$2" flexWrap="wrap">
              {groupInfo.texts.map((_, index) => {
                const isActive = !isCompleted && index === currentGroupIndex;
                return (
                  <Box
                    key={index}
                    paddingHorizontal="$2"
                    paddingVertical="$1"
                    borderRadius="$4"
                    backgroundColor={isActive ? "$primary" : "$backgroundMuted"}>
                    <Text
                      size="xs"
                      fontWeight={isActive ? "600" : "400"}
                      color={isActive ? "$typographyContrast" : "$typographySecondary"}>
                      {t(`athkar.group.labels.${index}`)}
                    </Text>
                  </Box>
                );
              })}
            </HStack>
          )}

          {/* Progress Section */}
          <VStack gap="$2">
            {/* Counter with buttons */}
            <HStack justifyContent="space-between" alignItems="center">
              <HStack gap="$2" alignItems="center">
                {currentCount > 0 && (
                  <Button
                    size="xs"
                    variant="outline"
                    action="default"
                    accessibilityLabel={t("common.decrement")}
                    onPress={(e: any) => {
                      e.stopPropagation();
                      decrementCount(athkar.id);
                      hapticWarning();
                    }}
                    width={44}
                    height={44}
                    padding={0}
                    borderRadius={999}
                    backgroundColor={isCompleted ? "$backgroundMuted" : "transparent"}
                    borderColor={isCompleted ? "$outlineSecondary" : "$info"}>
                    <Icon as={Minus} color="$info" />
                  </Button>
                )}
              </HStack>
              <HStack alignItems="center" gap="$2">
                {showAudioIcon && !isCompleted && (
                  <Pressable
                    onPress={(e: any) => {
                      e.stopPropagation();
                      hapticSelection();
                      if (!onboardingCompleted && onRequestOnboarding) {
                        onRequestOnboarding();
                        return;
                      }
                      if (isThisPlaying) {
                        athkarPlayer.pause();
                      } else if (isThisPaused) {
                        athkarPlayer.play();
                      } else {
                        athkarPlayer.jumpTo(athkar.id);
                      }
                    }}
                    width={32}
                    height={32}
                    borderRadius={16}
                    backgroundColor={
                      isThisPlaying || isThisPaused ? "$primary" : "$backgroundMuted"
                    }
                    alignItems="center"
                    justifyContent="center">
                    <Icon
                      as={isThisPlaying ? Pause : Play}
                      size="xs"
                      color={isThisPlaying || isThisPaused ? "$typographyContrast" : "$primary"}
                    />
                  </Pressable>
                )}
                {/* Count Display */}
                <Text
                  size="md"
                  fontWeight="500"
                  color={isCompleted ? "$typographyContrast" : "$typographySecondary"}>
                  {isRTL
                    ? `${formatNumberToLocale(`${total}`)} / ${formatNumberToLocale(`${currentCount}`)}`
                    : `${formatNumberToLocale(`${currentCount}`)} / ${formatNumberToLocale(`${total}`)}`}
                </Text>
              </HStack>
            </HStack>

            {/* Progress Bar */}
            <Progress value={progressPercentage} size="md" backgroundColor="$backgroundMuted">
              <ProgressFilledTrack
                backgroundColor={isCompleted ? "$typographyContrast" : "$primary"}
              />
            </Progress>
          </VStack>

          {isCompleted && (
            <Box
              position="absolute"
              top={-8}
              end={-8}
              width={40}
              height={40}
              borderRadius={999}
              backgroundColor="$success"
              alignItems="center"
              justifyContent="center">
              <Icon as={Check} color="$typographyContrast" />
            </Box>
          )}
        </VStack>
      </Box>
    </Pressable>
  );
};

export default AthkarCard;
