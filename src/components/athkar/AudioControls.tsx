import { FC, useState, useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { AccessibilityInfo, LayoutChangeEvent, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  Easing,
} from "react-native-reanimated";

import { useTheme } from "tamagui";

import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";
import { Pressable } from "@/components/ui/pressable";
import { Icon } from "@/components/ui/icon";
import { Play, Pause, SkipBack, SkipForward, X } from "lucide-react-native";

import { useAthkarStore } from "@/stores/athkar";
import { useAthkarAudioStore } from "@/stores/athkar-audio";
import { athkarPlayer } from "@/services/athkar-player";
import { useRTL } from "@/contexts/RTLContext";
import { AUDIO_UI } from "@/constants/AthkarAudio";
import { formatNumberToLocale } from "@/utils/number";
import { useHaptic } from "@/hooks/useHaptic";

type Props = {
  onPlayPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onCollapse: () => void;
  onDismiss: () => void;
};

const formatTime = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};

const TRACK_HEIGHT = 4;
const TRACK_HEIGHT_SEEKING = 8;
const THUMB_SIZE = 16;
const TOUCH_TARGET_HEIGHT = 44;

const EASE_OUT = Easing.out(Easing.cubic);
const EASE_IN = Easing.in(Easing.cubic);

const AudioControls: FC<Props> = ({ onPlayPause, onNext, onPrevious, onCollapse, onDismiss }) => {
  const { t } = useTranslation();
  const { isRTL } = useRTL();
  const theme = useTheme();
  const hapticSelection = useHaptic("selection");

  const playerState = useAthkarStore((s) => s.playerState);
  const repeatProgress = useAthkarStore((s) => s.repeatProgress);
  const audioDuration = useAthkarAudioStore((s) => s.duration);
  const audioPosition = useAthkarAudioStore((s) => s.position);
  const comfortMode = useAthkarAudioStore((s) => s.comfortMode);

  const isPlaying = playerState === "playing";
  const isLoading = playerState === "loading";
  const progressPercent = audioDuration > 0 ? audioPosition / audioDuration : 0;

  const controlSize = comfortMode ? AUDIO_UI.CONTROL_SIZE_COMFORT : AUDIO_UI.CONTROL_SIZE;
  const playSize = controlSize + 12;

  // RTL: swap prev/next icons
  const PrevIcon = isRTL ? SkipForward : SkipBack;
  const NextIcon = isRTL ? SkipBack : SkipForward;

  // Reduce motion
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);

  // Seek state
  const [trackWidth, setTrackWidth] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekDisplayTime, setSeekDisplayTime] = useState(0);
  const [showSeekHint, setShowSeekHint] = useState(false);
  const seekHintShown = useRef(false);
  const seekProgress = useSharedValue(0);
  const isSeeking_ = useSharedValue(false);
  const trackScale = useSharedValue(1);
  const thumbOpacity = useSharedValue(0);

  const onTrackLayout = useCallback((e: LayoutChangeEvent) => {
    setTrackWidth(e.nativeEvent.layout.width);
  }, []);

  const commitSeek = useCallback(
    (progress: number) => {
      if (audioDuration > 0) {
        const clamped = Math.max(0, Math.min(1, progress));
        athkarPlayer.seekTo(clamped * audioDuration);
      }
      setIsSeeking(false);
    },
    [audioDuration]
  );

  const enterSeekMode = useCallback(() => {
    setIsSeeking(true);
    hapticSelection();
  }, [hapticSelection]);

  const updateSeekDisplay = useCallback(
    (progress: number) => {
      setSeekDisplayTime(Math.max(0, Math.min(1, progress)) * audioDuration);
    },
    [audioDuration]
  );

  const animDuration = reduceMotion ? 0 : 150;

  const seekGesture = Gesture.Pan()
    .activateAfterLongPress(250)
    .onStart((e) => {
      const x = isRTL ? trackWidth - e.x : e.x;
      const progress = trackWidth > 0 ? x / trackWidth : 0;
      const clamped = Math.max(0, Math.min(1, progress));
      seekProgress.value = clamped;
      isSeeking_.value = true;
      trackScale.value = withTiming(TRACK_HEIGHT_SEEKING / TRACK_HEIGHT, {
        duration: animDuration,
        easing: EASE_OUT,
      });
      thumbOpacity.value = withTiming(1, { duration: animDuration, easing: EASE_OUT });
      runOnJS(enterSeekMode)();
      runOnJS(updateSeekDisplay)(clamped);
    })
    .onUpdate((e) => {
      const x = isRTL ? trackWidth - e.x : e.x;
      const progress = trackWidth > 0 ? x / trackWidth : 0;
      const clamped = Math.max(0, Math.min(1, progress));
      seekProgress.value = clamped;
      runOnJS(updateSeekDisplay)(clamped);
    })
    .onEnd(() => {
      const finalProgress = seekProgress.value;
      trackScale.value = withTiming(1, { duration: animDuration, easing: EASE_IN });
      thumbOpacity.value = withTiming(0, { duration: animDuration, easing: EASE_IN });
      isSeeking_.value = false;
      runOnJS(commitSeek)(finalProgress);
    })
    .onFinalize(() => {
      trackScale.value = withTiming(1, { duration: animDuration, easing: EASE_IN });
      thumbOpacity.value = withTiming(0, { duration: animDuration, easing: EASE_IN });
      isSeeking_.value = false;
    });

  // Swipe-down-to-collapse gesture
  const swipeTranslateY = useSharedValue(0);

  const swipeGesture = Gesture.Pan()
    .activeOffsetY(20)
    .onUpdate((e) => {
      if (isSeeking_.value) return;
      if (e.translationY > 0) {
        swipeTranslateY.value = e.translationY;
      }
    })
    .onEnd((e) => {
      if (isSeeking_.value) {
        swipeTranslateY.value = withTiming(0, { duration: reduceMotion ? 0 : 250 });
        return;
      }
      if (e.translationY > 50 && e.velocityY > 300) {
        runOnJS(onCollapse)();
      }
      swipeTranslateY.value = withTiming(0, { duration: reduceMotion ? 0 : 250 });
    })
    .onFinalize(() => {
      swipeTranslateY.value = withTiming(0, { duration: reduceMotion ? 0 : 250 });
    });

  const swipeAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: swipeTranslateY.value }],
    opacity: 1 - swipeTranslateY.value / 200,
  }));

  const trackAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: trackScale.value }],
  }));

  const filledTrackStyle = useAnimatedStyle(() => {
    const percent = isSeeking_.value ? seekProgress.value : progressPercent;
    return {
      width: `${percent * 100}%`,
    };
  });

  const thumbStyle = useAnimatedStyle(() => ({
    opacity: thumbOpacity.value,
    left: `${seekProgress.value * 100}%`,
  }));

  const trackVerticalPad = (TOUCH_TARGET_HEIGHT - TRACK_HEIGHT) / 2;

  return (
    <GestureDetector gesture={swipeGesture}>
      <Animated.View style={swipeAnimatedStyle}>
        <Box
          paddingHorizontal="$4"
          paddingVertical="$3"
          backgroundColor="$backgroundSecondary"
          borderTopStartRadius="$6"
          borderTopEndRadius="$6">
          {/* Close button — tap to collapse, long-press to dismiss */}
          <Pressable
            onPress={onCollapse}
            onLongPress={() => {
              hapticSelection();
              onDismiss();
            }}
            delayLongPress={500}
            width={44}
            height={44}
            borderRadius={22}
            alignItems="center"
            justifyContent="center"
            style={{ position: "absolute", top: 4, end: 4, zIndex: 1 }}
            accessibilityLabel={t("athkar.audio.minimize", { defaultValue: "Minimize" })}
            accessibilityHint={t("athkar.audio.minimizeHint", {
              defaultValue: "Long press to stop",
            })}>
            <Icon as={X} size="sm" color="$typographySecondary" />
          </Pressable>

          <VStack gap="$2">
            {/* Seekable progress bar */}
            <VStack gap="$1">
              <GestureDetector gesture={seekGesture}>
                <View
                  onLayout={onTrackLayout}
                  onTouchStart={() => {
                    if (!seekHintShown.current && !isSeeking) {
                      seekHintShown.current = true;
                      setShowSeekHint(true);
                      setTimeout(() => setShowSeekHint(false), 2000);
                    }
                  }}
                  style={{
                    paddingVertical: trackVerticalPad,
                    justifyContent: "center",
                    minHeight: TOUCH_TARGET_HEIGHT,
                  }}
                  accessibilityRole="adjustable"
                  accessibilityLabel={t("athkar.audio.seekBar", {
                    defaultValue: "Audio progress",
                  })}
                  accessibilityValue={{
                    min: 0,
                    max: 100,
                    now: Math.round(progressPercent * 100),
                  }}>
                  <Animated.View
                    style={[
                      {
                        height: TRACK_HEIGHT,
                        borderRadius: TRACK_HEIGHT / 2,
                        backgroundColor: theme.backgroundMuted.val,
                        overflow: "visible",
                        justifyContent: "center",
                      },
                      trackAnimatedStyle,
                    ]}>
                    {/* Filled track */}
                    <Animated.View
                      style={[
                        {
                          position: "absolute",
                          top: 0,
                          bottom: 0,
                          start: 0,
                          borderRadius: TRACK_HEIGHT / 2,
                        },
                        filledTrackStyle,
                      ]}>
                      <View
                        style={{
                          flex: 1,
                          borderRadius: TRACK_HEIGHT / 2,
                          backgroundColor: theme.primary.val,
                        }}
                      />
                    </Animated.View>
                  </Animated.View>

                  {/* Thumb */}
                  <Animated.View
                    style={[
                      {
                        position: "absolute",
                        width: THUMB_SIZE,
                        height: THUMB_SIZE,
                        borderRadius: THUMB_SIZE / 2,
                        marginStart: -(THUMB_SIZE / 2),
                        top: trackVerticalPad - THUMB_SIZE / 2 + TRACK_HEIGHT / 2,
                      },
                      thumbStyle,
                    ]}>
                    <View
                      style={{
                        flex: 1,
                        borderRadius: THUMB_SIZE / 2,
                        backgroundColor: theme.primary.val,
                      }}
                    />
                  </Animated.View>
                </View>
              </GestureDetector>

              {/* Seek hint — shown once on first tap */}
              {showSeekHint && (
                <Text size="xs" color="$primary" textAlign="center" marginTop="$1">
                  {t("athkar.audio.seekHint")}
                </Text>
              )}

              {/* Time display */}
              {isSeeking ? (
                <HStack justifyContent="space-between">
                  <Text size="xs" color="$primary" fontWeight="500">
                    {formatTime(seekDisplayTime)}
                  </Text>
                  <Text size="xs" color="$typographySecondary">
                    {formatTime(audioDuration)}
                  </Text>
                </HStack>
              ) : (
                audioDuration > 0 && (
                  <HStack justifyContent="space-between">
                    <Text size="xs" color="$typographySecondary">
                      {formatTime(audioPosition)}
                    </Text>
                    <Text size="xs" color="$typographySecondary">
                      {formatTime(audioDuration)}
                    </Text>
                  </HStack>
                )
              )}
            </VStack>

            {/* Controls row */}
            <HStack justifyContent="center" alignItems="center" gap={AUDIO_UI.CONTROL_GAP * 3}>
              {/* Previous */}
              <Pressable
                onPress={onPrevious}
                width={controlSize}
                height={controlSize}
                borderRadius={controlSize / 2}
                backgroundColor="$backgroundMuted"
                alignItems="center"
                justifyContent="center"
                accessibilityLabel={t("athkar.audio.previous")}>
                <Icon as={PrevIcon} size="md" color="$typography" />
                {comfortMode && (
                  <Text size="xs" color="$typographySecondary">
                    {t("athkar.audio.previous")}
                  </Text>
                )}
              </Pressable>

              {/* Play/Pause */}
              <Pressable
                onPress={onPlayPause}
                width={playSize}
                height={playSize}
                borderRadius={playSize / 2}
                backgroundColor="$primary"
                alignItems="center"
                justifyContent="center"
                opacity={isLoading ? 0.6 : 1}
                disabled={isLoading}
                accessibilityLabel={isPlaying ? t("athkar.audio.pause") : t("athkar.audio.play")}>
                <Icon as={isPlaying ? Pause : Play} size="lg" color="$typographyContrast" />
                {comfortMode && (
                  <Text size="xs" color="$typographyContrast">
                    {isPlaying ? t("athkar.audio.pause") : t("athkar.audio.play")}
                  </Text>
                )}
              </Pressable>

              {/* Next */}
              <Pressable
                onPress={onNext}
                width={controlSize}
                height={controlSize}
                borderRadius={controlSize / 2}
                backgroundColor="$backgroundMuted"
                alignItems="center"
                justifyContent="center"
                accessibilityLabel={t("athkar.audio.next")}>
                <Icon as={NextIcon} size="md" color="$typography" />
                {comfortMode && (
                  <Text size="xs" color="$typographySecondary">
                    {t("athkar.audio.next")}
                  </Text>
                )}
              </Pressable>
            </HStack>

            {/* Repeat counter */}
            {repeatProgress.total > 1 && (
              <Text size="xs" color="$typographySecondary" textAlign="center">
                {t("athkar.audio.repeatCount", {
                  current: formatNumberToLocale(`${repeatProgress.current}`),
                  total: formatNumberToLocale(`${repeatProgress.total}`),
                })}
              </Text>
            )}
          </VStack>
        </Box>
      </Animated.View>
    </GestureDetector>
  );
};

// Compact bar shown when audio controls are collapsed
type CollapsedBarProps = {
  onExpand: () => void;
  onPlayPause: () => void;
};

export const CollapsedAudioBar: FC<CollapsedBarProps> = ({ onExpand, onPlayPause }) => {
  const { t } = useTranslation();

  const playerState = useAthkarStore((s) => s.playerState);
  const sessionProgress = useAthkarStore((s) => s.sessionProgress);

  const isPlaying = playerState === "playing";
  const isLoading = playerState === "loading";
  const progressPercent =
    sessionProgress.total > 0 ? sessionProgress.current / sessionProgress.total : 0;

  return (
    <Pressable
      onPress={onExpand}
      accessibilityLabel={t("athkar.audio.expand", { defaultValue: "Expand audio controls" })}>
      <HStack
        height={48}
        paddingHorizontal="$4"
        backgroundColor="$backgroundSecondary"
        borderTopStartRadius="$6"
        borderTopEndRadius="$6"
        alignItems="center"
        gap="$3">
        {/* Play/Pause mini button */}
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            onPlayPause();
          }}
          width={36}
          height={36}
          borderRadius={18}
          backgroundColor="$primary"
          alignItems="center"
          justifyContent="center"
          opacity={isLoading ? 0.6 : 1}
          disabled={isLoading}
          accessibilityLabel={isPlaying ? t("athkar.audio.pause") : t("athkar.audio.play")}>
          <Icon as={isPlaying ? Pause : Play} size="sm" color="$typographyContrast" />
        </Pressable>

        {/* Session progress bar */}
        <Box flex={1} height={4} borderRadius={2} backgroundColor="$backgroundMuted">
          <Box
            height={4}
            borderRadius={2}
            backgroundColor="$primary"
            style={{ width: `${progressPercent * 100}%` }}
          />
        </Box>
      </HStack>
    </Pressable>
  );
};

export default AudioControls;
