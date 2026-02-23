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
import { usePathname } from "expo-router";

import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Icon } from "@/components/ui/icon";
import { Progress, ProgressFilledTrack } from "@/components/ui/progress";
import { Play, Pause, X } from "lucide-react-native";

import { useAthkarStore } from "@/stores/athkar";
import { useAthkarAudioStore } from "@/stores/athkar-audio";
import { athkarPlayer } from "@/services/athkar-player";
import { AUDIO_UI } from "@/constants/AthkarAudio";
import { formatNumberToLocale } from "@/utils/number";

const DISMISS_THRESHOLD = 60;

const MiniPlayerBar: FC = () => {
  const { t } = useTranslation();
  const pathname = usePathname();

  const playerState = useAthkarStore((s) => s.playerState);
  const sessionProgress = useAthkarStore((s) => s.sessionProgress);
  const comfortMode = useAthkarAudioStore((s) => s.comfortMode);
  const audioDuration = useAthkarAudioStore((s) => s.duration);
  const audioPosition = useAthkarAudioStore((s) => s.position);

  const translateY = useSharedValue(0);
  const opacity = useSharedValue(1);

  const isActive =
    playerState === "playing" || playerState === "paused" || playerState === "loading";

  const isFocusScreen = pathname === "/athkar-focus";

  useEffect(() => {
    if (isActive) {
      translateY.value = 0;
      opacity.value = 1;
    }
  }, [isActive, translateY, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  if (!isActive || isFocusScreen) return null;

  const isPlaying = playerState === "playing";
  const height = comfortMode ? AUDIO_UI.MINI_PLAYER_HEIGHT_COMFORT : AUDIO_UI.MINI_PLAYER_HEIGHT;
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
        <Pressable onPress={handleTap}>
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
              {/* Session progress badge */}
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

export default MiniPlayerBar;
