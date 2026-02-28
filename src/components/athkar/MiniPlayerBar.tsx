import { FC, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
} from "react-native-reanimated";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Icon } from "@/components/ui/icon";
import { Play, Pause, X } from "lucide-react-native";

import { useAthkarStore } from "@/stores/athkar";
import { useAthkarAudioStore } from "@/stores/athkar-audio";
import { athkarPlayer } from "@/services/athkar-player";
import { AUDIO_UI } from "@/constants/AthkarAudio";
import { formatNumberToLocale } from "@/utils/number";

const DISMISS_THRESHOLD = 60;

const MiniPlayerBar: FC = () => {
  const { t } = useTranslation();

  const playerState = useAthkarStore((s) => s.playerState);
  const sessionProgress = useAthkarStore((s) => s.sessionProgress);
  const groupProgress = useAthkarStore((s) => s.groupProgress);
  const comfortMode = useAthkarAudioStore((s) => s.comfortMode);
  const audioDuration = useAthkarAudioStore((s) => s.duration);
  const audioPosition = useAthkarAudioStore((s) => s.position);

  const isActive =
    playerState === "playing" || playerState === "paused" || playerState === "loading";
  const height = comfortMode ? AUDIO_UI.MINI_PLAYER_HEIGHT_COMFORT : AUDIO_UI.MINI_PLAYER_HEIGHT;

  const heightAnim = useSharedValue(isActive ? height : 0);
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (isActive) {
      heightAnim.value = height;
      opacity.value = 1;
    }
  }, [isActive, height, heightAnim, opacity]);

  const containerStyle = useAnimatedStyle(() => ({
    height: heightAnim.value,
    overflow: "hidden" as const,
    opacity: opacity.value,
  }));

  if (!isActive) return null;

  const isPlaying = playerState === "playing";
  const progressPercent = audioDuration > 0 ? (audioPosition / audioDuration) * 100 : 0;

  const handlePlayPause = (e: any) => {
    e.stopPropagation();
    if (isPlaying) {
      athkarPlayer.pause();
    } else {
      athkarPlayer.play();
    }
  };

  const handleDismiss = () => {
    athkarPlayer.stop();
  };

  const handleTap = () => {
    useAthkarAudioStore.getState().setShowBottomSheet(true);
  };

  const swipeDismiss = Gesture.Pan()
    .activeOffsetY([10, 100])
    .failOffsetX([-30, 30])
    .onUpdate((e) => {
      const clamped = Math.max(0, e.translationY);
      const progress = Math.min(clamped / DISMISS_THRESHOLD, 1);
      heightAnim.value = height * (1 - progress);
      opacity.value = 1 - progress;
    })
    .onEnd((e) => {
      if (e.translationY > DISMISS_THRESHOLD) {
        heightAnim.value = withTiming(0, { duration: 150 });
        opacity.value = withTiming(0, { duration: 150 });
        runOnJS(handleDismiss)();
      } else {
        heightAnim.value = withSpring(height, { damping: 20, stiffness: 300 });
        opacity.value = withSpring(1);
      }
    });

  return (
    <GestureDetector gesture={swipeDismiss}>
      <Animated.View style={containerStyle}>
        <Pressable onPress={handleTap}>
          <Box
            height={height}
            backgroundColor="$backgroundSecondary"
            borderTopWidth={1}
            borderTopColor="$outline"
            paddingHorizontal="$4"
            justifyContent="center">
            <HStack alignItems="center" gap="$3">
              {/* Session/group progress badge */}
              <Box
                width={36}
                height={36}
                borderRadius={18}
                backgroundColor="$primary"
                alignItems="center"
                justifyContent="center">
                <Text size="xs" fontWeight="600" color="$typographyContrast">
                  {groupProgress
                    ? formatNumberToLocale(`${groupProgress.count}`)
                    : formatNumberToLocale(`${sessionProgress.current}`)}
                </Text>
              </Box>

              {/* Info */}
              <Box flex={1}>
                <Text size="sm" fontWeight="500" color="$typography" numberOfLines={1}>
                  {groupProgress
                    ? t(`athkar.group.labels.${groupProgress.groupIndex}`)
                    : t("athkar.audio.nowPlaying")}
                </Text>
                <Text size="xs" color="$typographySecondary">
                  {groupProgress
                    ? t("athkar.focus.round", {
                        current: formatNumberToLocale(`${groupProgress.round}`),
                        total: formatNumberToLocale(`${groupProgress.totalRounds}`),
                      })
                    : `${formatNumberToLocale(`${sessionProgress.current}`)}/${formatNumberToLocale(`${sessionProgress.total}`)}`}
                </Text>
              </Box>

              {/* Play/Pause */}
              <Pressable
                onPress={handlePlayPause}
                width={40}
                height={40}
                borderRadius={20}
                backgroundColor="$primary"
                alignItems="center"
                justifyContent="center"
                accessibilityLabel={isPlaying ? t("athkar.audio.pause") : t("athkar.audio.play")}>
                <Icon as={isPlaying ? Pause : Play} size="md" color="$typographyContrast" />
              </Pressable>

              {/* Close */}
              <Pressable
                onPress={handleDismiss}
                width={32}
                height={32}
                borderRadius={16}
                backgroundColor="$backgroundMuted"
                alignItems="center"
                justifyContent="center"
                accessibilityLabel={t("athkar.audio.stop")}>
                <Icon as={X} size="xs" color="$typographySecondary" />
              </Pressable>
            </HStack>

            {/* Progress bar at bottom edge */}
            <Box
              style={{ position: "absolute", bottom: 0, left: 0, right: 0 }}
              height={3}
              backgroundColor="$backgroundMuted">
              <Box
                height={3}
                backgroundColor="$primary"
                borderRadius={2}
                style={{ width: `${progressPercent}%` }}
              />
            </Box>
          </Box>
        </Pressable>
      </Animated.View>
    </GestureDetector>
  );
};

export default MiniPlayerBar;
