import { FC, useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AccessibilityInfo, Dimensions, StyleSheet } from "react-native";
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from "react-native-reanimated";

import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";
import { Pressable } from "@/components/ui/pressable";
import { Icon } from "@/components/ui/icon";
import { Play, Pause, SkipBack, SkipForward, X, ChevronDown } from "lucide-react-native";

import { useAthkarStore } from "@/stores/athkar";
import { useAthkarAudioStore } from "@/stores/athkar-audio";
import { athkarPlayer } from "@/services/athkar-player";
import { useRTL } from "@/contexts/RTLContext";
import { formatNumberToLocale } from "@/utils/number";
import { useHaptic } from "@/hooks/useHaptic";
import { PLAYBACK_RATE_OPTIONS, DEFAULT_PLAYBACK_RATE } from "@/constants/AthkarAudio";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.5;

const formatTime = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};

const PlayerBottomSheet: FC = () => {
  const { t } = useTranslation();
  const { isRTL } = useRTL();

  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);

  const playerState = useAthkarStore((s) => s.playerState);
  const repeatProgress = useAthkarStore((s) => s.repeatProgress);
  const sessionProgress = useAthkarStore((s) => s.sessionProgress);
  const showBottomSheet = useAthkarAudioStore((s) => s.showBottomSheet);
  const position = useAthkarAudioStore((s) => s.position);
  const duration = useAthkarAudioStore((s) => s.duration);
  const playbackRate = useAthkarAudioStore((s) => s.playbackRate);
  const hapticSelection = useHaptic("selection");

  const cycleRate = useCallback(() => {
    const idx = PLAYBACK_RATE_OPTIONS.indexOf(
      playbackRate as (typeof PLAYBACK_RATE_OPTIONS)[number]
    );
    const safeIdx = idx === -1 ? PLAYBACK_RATE_OPTIONS.indexOf(DEFAULT_PLAYBACK_RATE) : idx;
    const next = PLAYBACK_RATE_OPTIONS[(safeIdx + 1) % PLAYBACK_RATE_OPTIONS.length];
    athkarPlayer.setPlaybackRate(next);
    hapticSelection();
  }, [playbackRate, hapticSelection]);

  const rateLabel = formatNumberToLocale(String(playbackRate));

  const isPlaying = playerState === "playing";
  const isLoading = playerState === "loading";

  const PrevIcon = isRTL ? SkipForward : SkipBack;
  const NextIcon = isRTL ? SkipBack : SkipForward;

  const handleClose = useCallback(() => {
    useAthkarAudioStore.getState().setShowBottomSheet(false);
  }, []);

  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      athkarPlayer.pause();
    } else {
      athkarPlayer.play();
    }
  }, [isPlaying]);

  const handleNext = useCallback(() => {
    athkarPlayer.next();
  }, []);

  const handlePrevious = useCallback(() => {
    athkarPlayer.previous();
  }, []);

  const handleStop = useCallback(() => {
    athkarPlayer.stop();
    useAthkarAudioStore.getState().setShowBottomSheet(false);
  }, []);

  if (!showBottomSheet) return null;

  const progressPercent = duration > 0 ? (position / duration) * 100 : 0;

  return (
    <>
      {/* Backdrop */}
      <Pressable
        onPress={handleClose}
        style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.4)" }]}
      />

      {/* Sheet */}
      <Animated.View
        entering={
          reduceMotion ? FadeIn.duration(1) : SlideInDown.springify().damping(20).stiffness(200)
        }
        exiting={reduceMotion ? FadeOut.duration(1) : SlideOutDown.duration(200)}
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: SHEET_HEIGHT,
        }}>
        <Box
          flex={1}
          backgroundColor="$backgroundSecondary"
          borderTopStartRadius={24}
          borderTopEndRadius={24}
          paddingHorizontal="$6"
          paddingTop="$4"
          paddingBottom="$8">
          {/* Handle + Close */}
          <HStack justifyContent="space-between" alignItems="center" marginBottom="$4">
            <Pressable
              onPress={handleClose}
              width={44}
              height={44}
              borderRadius={22}
              alignItems="center"
              justifyContent="center"
              accessibilityLabel={t("common.close")}
              accessibilityRole="button">
              <Icon as={ChevronDown} size="md" color="$typographySecondary" />
            </Pressable>

            <Text size="sm" fontWeight="600" color="$typography">
              {t("athkar.audio.nowPlaying")}
            </Text>

            <Pressable
              onPress={handleStop}
              width={44}
              height={44}
              borderRadius={22}
              alignItems="center"
              justifyContent="center"
              accessibilityLabel={t("common.stop")}
              accessibilityRole="button">
              <Icon as={X} size="sm" color="$typographySecondary" />
            </Pressable>
          </HStack>

          <VStack flex={1} justifyContent="center" gap="$6">
            {/* Session progress */}
            <Text size="sm" color="$typographySecondary" textAlign="center">
              {t("athkar.audio.thikrProgress", {
                current: formatNumberToLocale(`${sessionProgress.current}`),
                total: formatNumberToLocale(`${sessionProgress.total}`),
              })}
            </Text>

            {/* Repeat progress */}
            {repeatProgress.total > 1 && (
              <Text size="lg" fontWeight="600" color="$typography" textAlign="center">
                {t("athkar.audio.repeatCount", {
                  current: formatNumberToLocale(`${repeatProgress.current}`),
                  total: formatNumberToLocale(`${repeatProgress.total}`),
                })}
              </Text>
            )}

            {/* Progress bar */}
            <VStack gap="$1">
              <Box
                height={4}
                borderRadius={2}
                backgroundColor="$backgroundMuted"
                accessibilityRole="progressbar"
                accessibilityValue={{ min: 0, max: 100, now: Math.round(progressPercent) }}>
                <Box
                  height={4}
                  borderRadius={2}
                  backgroundColor="$primary"
                  style={{ width: `${progressPercent}%` }}
                />
              </Box>
              {duration > 0 && (
                <HStack justifyContent="space-between">
                  <Text size="xs" color="$typographySecondary">
                    {formatTime(position)}
                  </Text>
                  <Text size="xs" color="$typographySecondary">
                    {formatTime(duration)}
                  </Text>
                </HStack>
              )}
            </VStack>

            {/* Controls */}
            <HStack justifyContent="center" alignItems="center" gap="$8">
              {/* Previous */}
              <Pressable
                onPress={handlePrevious}
                width={56}
                height={56}
                borderRadius={28}
                backgroundColor="$backgroundMuted"
                alignItems="center"
                justifyContent="center"
                accessibilityLabel={t("athkar.audio.previous")}>
                <Icon as={PrevIcon} size="lg" color="$typography" />
              </Pressable>

              {/* Play/Pause */}
              <Pressable
                onPress={handlePlayPause}
                width={72}
                height={72}
                borderRadius={36}
                backgroundColor="$primary"
                alignItems="center"
                justifyContent="center"
                opacity={isLoading ? 0.6 : 1}
                disabled={isLoading}
                accessibilityLabel={isPlaying ? t("athkar.audio.pause") : t("athkar.audio.play")}>
                <Icon as={isPlaying ? Pause : Play} size="xl" color="$typographyContrast" />
              </Pressable>

              {/* Next */}
              <Pressable
                onPress={handleNext}
                width={56}
                height={56}
                borderRadius={28}
                backgroundColor="$backgroundMuted"
                alignItems="center"
                justifyContent="center"
                accessibilityLabel={t("athkar.audio.next")}>
                <Icon as={NextIcon} size="lg" color="$typography" />
              </Pressable>
            </HStack>

            {/* Speed pill */}
            <HStack justifyContent="center">
              <Pressable
                onPress={cycleRate}
                minWidth={64}
                height={36}
                paddingHorizontal="$4"
                borderRadius={18}
                backgroundColor="$backgroundMuted"
                alignItems="center"
                justifyContent="center"
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityRole="button"
                accessibilityLabel={t("athkar.audio.playbackRate", { rate: rateLabel })}
                accessibilityHint={t("athkar.audio.playbackRateHint")}
                accessibilityValue={{ text: `${rateLabel}x` }}>
                <Text size="sm" fontWeight="600" color="$primary">
                  {rateLabel}×
                </Text>
              </Pressable>
            </HStack>
          </VStack>
        </Box>
      </Animated.View>
    </>
  );
};

export default PlayerBottomSheet;
