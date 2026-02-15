import { FC, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
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
import { Progress, ProgressFilledTrack } from "@/components/ui/progress";
import { Play, Pause, X } from "lucide-react-native";

import { useAthkarAudioStore } from "@/stores/athkar-audio";
import { AUDIO_UI } from "@/constants/AthkarAudio";
import { formatNumberToLocale } from "@/utils/number";

const DISMISS_THRESHOLD = 60;

const MiniPlayer: FC = () => {
  const { t } = useTranslation();
  const router = useRouter();

  const playerState = useAthkarAudioStore((s) => s.playerState);
  const sessionProgress = useAthkarAudioStore((s) => s.sessionProgress);
  const comfortMode = useAthkarAudioStore((s) => s.comfortMode);
  const audioDuration = useAthkarAudioStore((s) => s.audioDuration);
  const audioPosition = useAthkarAudioStore((s) => s.audioPosition);
  const audioPlay = useAthkarAudioStore((s) => s.play);
  const audioPause = useAthkarAudioStore((s) => s.pause);
  const audioResume = useAthkarAudioStore((s) => s.resume);
  const audioDismiss = useAthkarAudioStore((s) => s.dismiss);

  const translateY = useSharedValue(0);
  const opacity = useSharedValue(1);

  const handleDismiss = useCallback(() => {
    audioDismiss();
  }, [audioDismiss]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const isActive =
    playerState === "playing" ||
    playerState === "paused" ||
    playerState === "loading" ||
    playerState === "advancing";

  useEffect(() => {
    if (isActive) {
      translateY.value = 0;
      opacity.value = 1;
    }
  }, [isActive, translateY, opacity]);

  if (!isActive) return null;

  const isPlaying = playerState === "playing";
  const height = comfortMode ? AUDIO_UI.MINI_PLAYER_HEIGHT_COMFORT : AUDIO_UI.MINI_PLAYER_HEIGHT;
  const progressPercent = audioDuration > 0 ? (audioPosition / audioDuration) * 100 : 0;

  const handlePlayPause = (e: any) => {
    e.stopPropagation();
    if (isPlaying) {
      audioPause();
    } else if (playerState === "paused") {
      audioResume();
    } else {
      audioPlay();
    }
  };

  const swipeDismiss = Gesture.Pan()
    .activeOffsetY([10, 100])
    .failOffsetX([-30, 30])
    .onUpdate((e) => {
      const clamped = Math.max(0, e.translationY);
      translateY.value = clamped;
      opacity.value = 1 - clamped / (DISMISS_THRESHOLD * 2);
    })
    .onEnd((e) => {
      if (e.translationY > DISMISS_THRESHOLD) {
        translateY.value = withTiming(height, { duration: 150 });
        opacity.value = withTiming(0, { duration: 150 });
        runOnJS(handleDismiss)();
      } else {
        translateY.value = withSpring(0, { damping: 20, stiffness: 300 });
        opacity.value = withSpring(1);
      }
    });

  return (
    <GestureDetector gesture={swipeDismiss}>
      <Animated.View style={animatedStyle}>
        <Pressable onPress={() => router.push("/athkar-focus")}>
          <Box
            height={height}
            backgroundColor="$backgroundSecondary"
            borderTopWidth={1}
            borderTopColor="$outline"
            paddingHorizontal="$4">
            {/* Drag handle hint */}
            <Box
              alignSelf="center"
              width={32}
              height={4}
              borderRadius={2}
              backgroundColor="$outline"
              style={{ position: "absolute", top: 4 }}
            />
            {/* Mini progress bar at top */}
            <Progress
              value={progressPercent}
              size="xs"
              backgroundColor="$backgroundMuted"
              style={{ position: "absolute", top: 10, left: 0, right: 0 }}>
              <ProgressFilledTrack backgroundColor="$primary" />
            </Progress>

            <HStack flex={1} alignItems="center" gap="$3" paddingTop="$1">
              {/* Session progress */}
              <Box
                width={40}
                height={40}
                borderRadius={20}
                backgroundColor="$primary"
                alignItems="center"
                justifyContent="center">
                <Text size="xs" fontWeight="600" color="$typographyContrast">
                  {formatNumberToLocale(`${sessionProgress.current}`)}
                </Text>
              </Box>

              {/* Info */}
              <Box flex={1}>
                <Text size="sm" fontWeight="500" color="$typography" numberOfLines={1}>
                  {t("athkar.audio.nowPlaying")}
                </Text>
                <Text size="xs" color="$typographySecondary">
                  {formatNumberToLocale(`${sessionProgress.current}`)}/
                  {formatNumberToLocale(`${sessionProgress.total}`)}
                </Text>
              </Box>

              {/* Play/Pause */}
              <Pressable
                onPress={handlePlayPause}
                width={44}
                height={44}
                borderRadius={22}
                backgroundColor="$primary"
                alignItems="center"
                justifyContent="center"
                accessibilityLabel={isPlaying ? t("athkar.audio.pause") : t("athkar.audio.play")}>
                <Icon as={isPlaying ? Pause : Play} size="md" color="$typographyContrast" />
              </Pressable>

              {/* Close */}
              <Pressable
                onPress={handleDismiss}
                width={44}
                height={44}
                borderRadius={22}
                alignItems="center"
                justifyContent="center"
                accessibilityLabel={t("athkar.audio.stop")}>
                <Icon as={X} size="sm" color="$typographySecondary" />
              </Pressable>
            </HStack>
          </Box>
        </Pressable>
      </Animated.View>
    </GestureDetector>
  );
};

export default MiniPlayer;
