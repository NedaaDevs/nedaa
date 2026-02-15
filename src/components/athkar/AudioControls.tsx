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

import { useAthkarAudioStore } from "@/stores/athkar-audio";
import { useRTL } from "@/contexts/RTLContext";
import { AUDIO_UI } from "@/constants/AthkarAudio";
import { formatNumberToLocale } from "@/utils/number";
import { useHaptic } from "@/hooks/useHaptic";

type Props = {
  onPlayPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onStop: () => void;
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

const AudioControls: FC<Props> = ({ onPlayPause, onNext, onPrevious, onStop }) => {
  const { t } = useTranslation();
  const { isRTL } = useRTL();
  const theme = useTheme();
  const hapticSelection = useHaptic("selection");

  const playerState = useAthkarAudioStore((s) => s.playerState);
  const currentRepeat = useAthkarAudioStore((s) => s.currentRepeat);
  const totalRepeats = useAthkarAudioStore((s) => s.totalRepeats);
  const audioDuration = useAthkarAudioStore((s) => s.audioDuration);
  const audioPosition = useAthkarAudioStore((s) => s.audioPosition);
  const comfortMode = useAthkarAudioStore((s) => s.comfortMode);
  const seekTo = useAthkarAudioStore((s) => s.seekTo);

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
        seekTo(clamped * audioDuration);
      }
      setIsSeeking(false);
    },
    [audioDuration, seekTo]
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
    <Box
      paddingHorizontal="$4"
      paddingVertical="$3"
      backgroundColor="$backgroundSecondary"
      borderTopStartRadius="$6"
      borderTopEndRadius="$6">
      {/* Stop button — top end corner */}
      <Pressable
        onPress={onStop}
        width={44}
        height={44}
        borderRadius={22}
        alignItems="center"
        justifyContent="center"
        style={{ position: "absolute", top: 4, end: 4, zIndex: 1 }}
        accessibilityLabel={t("athkar.audio.stop")}>
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
        {totalRepeats > 1 && (
          <Text size="xs" color="$typographySecondary" textAlign="center">
            {t("athkar.audio.repeatCount", {
              current: formatNumberToLocale(`${currentRepeat}`),
              total: formatNumberToLocale(`${totalRepeats}`),
            })}
          </Text>
        )}
      </VStack>
    </Box>
  );
};

export default AudioControls;
