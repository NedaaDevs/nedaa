import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { AccessibilityInfo, Dimensions, View } from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "tamagui";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  FadeIn,
  FadeOut,
  useAnimatedProps,
  withSpring,
  interpolateColor,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import Svg, { Circle } from "react-native-svg";

// Components
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Button } from "@/components/ui/button";
import { Progress, ProgressFilledTrack } from "@/components/ui/progress";
import {
  X,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  HelpCircle,
} from "lucide-react-native";
import { Icon } from "@/components/ui/icon";

import { AthkarFocusCompletion } from "@/components/athkar/AthkarFocusCompletion";
import AthkarTextDisplay from "@/components/athkar/AthkarTextDisplay";
import AudioControls from "@/components/athkar/AudioControls";
import AudioOnboarding from "@/components/athkar/AudioOnboarding";

// Stores
import { useAthkarStore } from "@/stores/athkar";
import { useAthkarAudioStore } from "@/stores/athkar-audio";

// Services
import { athkarPlayer } from "@/services/athkar-player";
import { reciterRegistry } from "@/services/athkar-reciter-registry";

// Constants
import { ATHKAR_TYPE } from "@/constants/Athkar";
import { PLAYBACK_MODE } from "@/constants/AthkarAudio";

// Hooks
import { useHaptic } from "@/hooks/useHaptic";
import { useAthkarAudioBridge } from "@/hooks/useAthkarAudioBridge";

// Utils
import { formatNumberToLocale } from "@/utils/number";
// Contexts
import { useRTL } from "@/contexts/RTLContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25;

// Create animated Circle component
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const getGroupDisplayText = (
  athkar: { group?: { texts: string[]; itemsPerRound: number }; text: string },
  currentCount: number
): string => {
  if (!athkar.group) return athkar.text;
  return athkar.group.texts[currentCount % athkar.group.itemsPerRound];
};

const AthkarFocusScreen = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const { isRTL } = useRTL();
  const theme = useTheme();

  const hapticSelection = useHaptic("selection");
  const hapticSuccess = useHaptic("success");
  const hapticWarning = useHaptic("warning");

  // Audio bridge
  useAthkarAudioBridge();

  const {
    morningAthkarList,
    eveningAthkarList,
    currentProgress,
    currentType,
    currentAthkarIndex,
    incrementCount,
    decrementCount,
    toggleFocusMode,
    findOptimalAthkarIndex,
    setCurrentAthkarIndex,
    updateLastIndex,
    moveToNext,
    moveToPrevious,
  } = useAthkarStore();

  // Audio store
  const playbackMode = useAthkarAudioStore((s) => s.playbackMode);
  const playerState = useAthkarAudioStore((s) => s.playerState);
  const selectedReciterId = useAthkarAudioStore((s) => s.selectedReciterId);
  const onboardingCompleted = useAthkarAudioStore((s) => s.onboardingCompleted);
  const audioPlay = useAthkarAudioStore((s) => s.play);
  const audioPause = useAthkarAudioStore((s) => s.pause);
  const audioResume = useAthkarAudioStore((s) => s.resume);
  const audioNext = useAthkarAudioStore((s) => s.next);
  const audioPrevious = useAthkarAudioStore((s) => s.previous);
  const audioStop = useAthkarAudioStore((s) => s.stop);
  const audioDismiss = useAthkarAudioStore((s) => s.dismiss);

  const audioDuration = useAthkarAudioStore((s) => s.audioDuration);
  const audioPosition = useAthkarAudioStore((s) => s.audioPosition);

  const shortVersion = useAthkarStore((s) => s.shortVersion);

  const showAudioControls = playbackMode !== PLAYBACK_MODE.OFF;
  const isAutopilot = playbackMode === PLAYBACK_MODE.AUTOPILOT;

  const showTranslation = useAthkarStore((s) => s.settings.showTranslation);

  // Reduce motion check
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);

  // Onboarding modal
  const [showOnboarding, setShowOnboarding] = useState(false);

  // State for showing instructions
  const [showInstructions, setShowInstructions] = useState(true);
  const [showSwipeIndicator, setShowSwipeIndicator] = useState(false);
  const [showNavigationIndicator, setShowNavigationIndicator] = useState(false);
  const swipeIndicatorOpacity = useSharedValue(0);
  const swipeIndicatorTranslateX = useSharedValue(0);
  const navigationIndicatorOpacity = useSharedValue(0);
  const navigationIndicatorTranslateY = useSharedValue(0);

  const slideTranslateY = useSharedValue(0);
  const slideOpacity = useSharedValue(1);
  const slideScale = useSharedValue(1);
  const navigationBlur = useSharedValue(0);

  // Animated values for circle progress
  const animatedProgress = useSharedValue(0);
  const circleScale = useSharedValue(1);
  const countOpacity = useSharedValue(1);
  const completionScale = useSharedValue(0);
  const audioProgressValue = useSharedValue(0);

  // Get current athkar list based on type
  const currentAthkarList =
    currentType === ATHKAR_TYPE.MORNING ? morningAthkarList : eveningAthkarList;

  // Initialize focus mode and optimal index on mount
  useEffect(() => {
    toggleFocusMode();

    // Set optimal starting index
    const optimalIndex = findOptimalAthkarIndex(currentType);
    setCurrentAthkarIndex(optimalIndex);
    updateLastIndex(currentType, optimalIndex);

    return () => {
      toggleFocusMode();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentType]);

  // Build audio queue when entering focus mode with audio enabled
  useEffect(() => {
    if (!showAudioControls || !selectedReciterId) return;
    if (athkarPlayer.isActive() || athkarPlayer.getQueueLength() > 0) return; // don't clobber a running or dismissed session

    const buildQueue = async () => {
      const catalog = await reciterRegistry.fetchCatalog();
      const reciter = catalog?.reciters.find((r) => r.id === selectedReciterId);
      if (!reciter) return;

      const manifest = await reciterRegistry.fetchManifest(selectedReciterId);
      if (!manifest) return;

      athkarPlayer.setMode(playbackMode);
      athkarPlayer.setRepeatLimit(useAthkarAudioStore.getState().repeatLimit);
      athkarPlayer.buildQueue(currentAthkarList, manifest, selectedReciterId, currentType);
    };

    buildQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAudioControls, selectedReciterId, currentType]);

  // Hide instructions after 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowInstructions(false);
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  // Get current athkar and progress using store's currentAthkarIndex
  const currentAthkar = currentAthkarList[currentAthkarIndex];

  const progressItem = currentProgress.find((p) => p.athkarId === currentAthkar?.id);

  const currentCount = progressItem?.currentCount || 0;
  const totalCount = progressItem?.totalCount || currentAthkar?.count || 1;
  const progressPercentage = (currentCount / totalCount) * 100;

  // Group-related derived state
  const isGrouped = !!currentAthkar?.group;
  const groupInfo = currentAthkar?.group;
  const currentGroupIndex = isGrouped ? currentCount % groupInfo!.itemsPerRound : 0;
  const currentRound = isGrouped ? Math.floor(currentCount / groupInfo!.itemsPerRound) + 1 : 0;
  const totalRounds = isGrouped ? totalCount / groupInfo!.itemsPerRound : 0;
  const displayTextKey = currentAthkar ? getGroupDisplayText(currentAthkar, currentCount) : "";

  // Track previous group index for text fade animation
  const [prevGroupIndex, setPrevGroupIndex] = useState(currentGroupIndex);
  const textFadeOpacity = useSharedValue(1);

  useEffect(() => {
    if (isGrouped && prevGroupIndex !== currentGroupIndex) {
      if (reduceMotion) {
        setPrevGroupIndex(currentGroupIndex);
        return;
      }
      textFadeOpacity.value = withTiming(0, { duration: 100 }, () => {
        textFadeOpacity.value = withTiming(1, { duration: 100 });
      });
      setPrevGroupIndex(currentGroupIndex);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentGroupIndex, isGrouped]);

  const textFadeStyle = useAnimatedStyle(() => ({
    opacity: textFadeOpacity.value,
  }));

  // Sync with store's currentAthkarIndex changes (auto-move functionality)
  useEffect(() => {
    if (currentAthkar) {
      if (reduceMotion) {
        animatedProgress.value = progressPercentage / 100;
      } else {
        animatedProgress.value = withSpring(progressPercentage / 100, {
          damping: 15,
          stiffness: 150,
          mass: 1,
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentAthkarIndex, currentAthkar, progressPercentage]);

  // Sync audio player when user navigates to different thikr
  useEffect(() => {
    if (showAudioControls && currentAthkar && playerState !== "idle") {
      athkarPlayer.jumpTo(currentAthkar.id, currentCount);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentAthkarIndex]);

  // Track previous index for slide direction
  const [previousIndex, setPreviousIndex] = useState(currentAthkarIndex);

  useEffect(() => {
    if (previousIndex !== currentAthkarIndex) {
      if (reduceMotion) {
        // Instant update — no animation
        slideOpacity.value = 1;
        slideScale.value = 1;
        slideTranslateY.value = 0;
        navigationBlur.value = 0;
        setPreviousIndex(currentAthkarIndex);
        return;
      }

      const isNext = currentAthkarIndex > previousIndex;
      const slideDirection = isNext ? -1 : 1; // Up = next (-1), Down = previous (+1)
      const SLIDE_DISTANCE = 80;

      // Slide out animation with scale and opacity
      slideOpacity.value = withTiming(0.4, { duration: 250 });
      slideScale.value = withTiming(0.92, { duration: 250 });
      slideTranslateY.value = withTiming(slideDirection * SLIDE_DISTANCE, { duration: 250 });
      navigationBlur.value = withTiming(0.5, { duration: 200 }, () => {
        // Reset position for slide in from opposite direction
        slideTranslateY.value = -slideDirection * SLIDE_DISTANCE;

        // Slide in animation with spring effects
        slideOpacity.value = withSpring(1, {
          damping: 18,
          stiffness: 280,
          mass: 0.9,
        });
        slideScale.value = withSpring(1, {
          damping: 16,
          stiffness: 220,
          mass: 0.8,
        });
        slideTranslateY.value = withSpring(0, {
          damping: 20,
          stiffness: 320,
          mass: 0.8,
        });
        navigationBlur.value = withSpring(0, {
          damping: 22,
          stiffness: 380,
          mass: 0.7,
        });
      });

      setPreviousIndex(currentAthkarIndex);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentAthkarIndex]);

  const isCompleted = progressItem?.completed ?? false;

  // Check if all athkars in current session are completed
  const allCompleted =
    currentProgress.length > 0 &&
    currentProgress.filter((p) => p.athkarId.includes(`-${currentType}`)).every((p) => p.completed);

  // Stop audio when all athkar completed
  useEffect(() => {
    if (allCompleted && playerState !== "idle") {
      audioStop();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allCompleted]);

  // Stop audio when shortVersion changes (athkar list changes)
  useEffect(() => {
    if (playerState !== "idle" && playerState !== "completed") {
      audioStop();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shortVersion]);

  // Animate completion celebration when all athkar are done
  useEffect(() => {
    if (allCompleted) {
      completionScale.value = reduceMotion ? 1 : withSpring(1, { damping: 15, stiffness: 200 });
      hapticSuccess();
    } else {
      completionScale.value = reduceMotion ? 0 : withTiming(0, { duration: 200 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allCompleted]);

  // Animate progress when count changes
  useEffect(() => {
    if (reduceMotion) {
      animatedProgress.value = progressPercentage / 100;
    } else {
      animatedProgress.value = withSpring(progressPercentage / 100, {
        damping: 15,
        stiffness: 150,
        mass: 1,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progressPercentage]);

  // Sync audio playback progress to the inner ring
  useEffect(() => {
    if (audioDuration > 0) {
      const progress = audioPosition / audioDuration;
      audioProgressValue.value = reduceMotion ? progress : withTiming(progress, { duration: 300 });
    } else {
      audioProgressValue.value = 0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioPosition, audioDuration]);

  // Circle constants
  const CIRCLE_RADIUS = 120;
  const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS;
  const AUDIO_RING_RADIUS = 106;
  const AUDIO_RING_CIRCUMFERENCE = 2 * Math.PI * AUDIO_RING_RADIUS;

  // Resolve theme colors for animation interpolation
  const progressStartColor = theme.info.val;
  const progressEndColor = theme.success.val;

  // Animated props for the progress circle
  const animatedCircleProps = useAnimatedProps(() => {
    const strokeDashoffset = CIRCLE_CIRCUMFERENCE * (1 - animatedProgress.value);

    return {
      strokeDashoffset,
      stroke: interpolateColor(
        animatedProgress.value,
        [0, 1],
        [progressStartColor, progressEndColor]
      ),
    };
  });

  // Animated props for the audio playback ring (inner)
  const audioCircleProps = useAnimatedProps(() => ({
    strokeDashoffset: AUDIO_RING_CIRCUMFERENCE * (1 - audioProgressValue.value),
  }));

  // Animated style for count text
  const countAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: countOpacity.value,
      transform: [{ scale: countOpacity.value }],
    };
  });

  // Handle tap to increment
  const handleTap = () => {
    // In autopilot, taps are disabled (counts come from audio)
    if (isAutopilot && playerState === "playing") return;

    if (!isCompleted && currentAthkar) {
      hapticSelection();

      if (!reduceMotion) {
        // Animate circle scale for feedback
        circleScale.value = withSpring(1.05, { damping: 20, stiffness: 300 }, () => {
          circleScale.value = withSpring(1, { damping: 20, stiffness: 300 });
        });

        // Animate count text
        countOpacity.value = withTiming(0.7, { duration: 100 }, () => {
          countOpacity.value = withTiming(1, { duration: 100 });
        });
      }

      incrementCount(currentAthkar.id);

      // Check if this tap completes the athkar
      if (currentCount + 1 === totalCount) {
        hapticSuccess();
        if (!reduceMotion) {
          circleScale.value = withSpring(1.1, { damping: 15, stiffness: 200 }, () => {
            circleScale.value = withSpring(1, { damping: 15, stiffness: 200 });
          });
        }
      }
    }
  };

  // Audio control handlers
  const handlePlayPause = useCallback(() => {
    // Check onboarding first
    if (!onboardingCompleted) {
      setShowOnboarding(true);
      return;
    }

    if (playerState === "playing") {
      audioPause();
    } else if (playerState === "paused") {
      audioResume();
    } else {
      // First play — sync queue to the thikr the user is currently viewing
      if (currentAthkar) {
        athkarPlayer.jumpTo(currentAthkar.id, currentCount);
      }
      audioPlay();
    }
  }, [
    playerState,
    onboardingCompleted,
    audioPlay,
    audioPause,
    audioResume,
    currentAthkar,
    currentCount,
  ]);

  const handleAudioNext = useCallback(() => {
    audioNext();
    moveToNext();
  }, [audioNext, moveToNext]);

  const handleAudioPrevious = useCallback(() => {
    audioPrevious();
    moveToPrevious();
  }, [audioPrevious, moveToPrevious]);

  // Handle horizontal swipe for decrement
  const horizontalSwipe = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .failOffsetY([-50, 50])
    .onStart(() => {
      scheduleOnRN(setShowSwipeIndicator, true);
      swipeIndicatorOpacity.value = withTiming(1, { duration: 200 });
    })
    .onUpdate((event) => {
      // Show swipe indicator movement
      swipeIndicatorTranslateX.value = event.translationX * 0.3;
    })
    .onEnd((event) => {
      const shouldDecrease = isRTL
        ? event.translationX > SWIPE_THRESHOLD
        : event.translationX < -SWIPE_THRESHOLD;

      if (shouldDecrease && currentCount > 0 && currentAthkar) {
        scheduleOnRN(hapticWarning);

        // Animate circle scale for decrement feedback
        circleScale.value = withSpring(0.95, { damping: 20, stiffness: 300 }, () => {
          circleScale.value = withSpring(1, { damping: 20, stiffness: 300 });
        });

        // Animate count text
        countOpacity.value = withTiming(0.7, { duration: 100 }, () => {
          countOpacity.value = withTiming(1, { duration: 100 });
        });

        scheduleOnRN(decrementCount, currentAthkar.id);
      }

      // Hide swipe indicator
      swipeIndicatorOpacity.value = withTiming(0, { duration: 200 });
      swipeIndicatorTranslateX.value = withTiming(0, { duration: 200 });
      scheduleOnRN(setShowSwipeIndicator, false);
    });

  // Handle vertical swipe for navigation
  const verticalSwipe = Gesture.Pan()
    .activeOffsetY([-20, 20])
    .failOffsetX([-50, 50])
    .onStart(() => {
      scheduleOnRN(setShowNavigationIndicator, true);
      navigationIndicatorOpacity.value = withTiming(1, { duration: 200 });
      // Scale feedback during gesture start
      slideScale.value = withTiming(0.98, { duration: 150 });
    })
    .onUpdate((event) => {
      // Navigation indicator movement
      navigationIndicatorTranslateY.value = event.translationY * 0.4;

      // Content movement during swipe
      const dampenedTranslation = event.translationY * 0.15;
      slideTranslateY.value = dampenedTranslation;

      // Dynamic opacity based on swipe distance
      const swipeProgress = Math.min(Math.abs(event.translationY) / 100, 1);
      navigationBlur.value = swipeProgress * 0.3;
    })
    .onEnd((event) => {
      const NAVIGATION_THRESHOLD = 60;

      if (event.translationY < -NAVIGATION_THRESHOLD) {
        // Swipe up - Next athkar
        scheduleOnRN(hapticSelection);
        slideScale.value = withSpring(1.02, { damping: 20, stiffness: 400 }, () => {
          slideScale.value = withSpring(1, { damping: 15, stiffness: 300 });
        });
        scheduleOnRN(moveToNext);
      } else if (event.translationY > NAVIGATION_THRESHOLD) {
        // Swipe down - Previous athkar
        scheduleOnRN(hapticSelection);
        slideScale.value = withSpring(1.02, { damping: 20, stiffness: 400 }, () => {
          slideScale.value = withSpring(1, { damping: 15, stiffness: 300 });
        });
        scheduleOnRN(moveToPrevious);
      } else {
        // Return to original state if swipe wasn't strong enough
        slideScale.value = withSpring(1, { damping: 15, stiffness: 300 });
      }

      // Return animations
      navigationIndicatorOpacity.value = withTiming(0, { duration: 250 });
      navigationIndicatorTranslateY.value = withSpring(0, { damping: 20, stiffness: 300 });
      slideTranslateY.value = withSpring(0, { damping: 20, stiffness: 300 });
      navigationBlur.value = withTiming(0, { duration: 200 });
      scheduleOnRN(setShowNavigationIndicator, false);
    });

  // Combine gestures
  const combinedGestures = Gesture.Simultaneous(horizontalSwipe, verticalSwipe);

  const swipeIndicatorStyle = useAnimatedStyle(() => {
    return {
      opacity: swipeIndicatorOpacity.value,
      transform: [{ translateX: swipeIndicatorTranslateX.value }],
    };
  });

  const navigationIndicatorStyle = useAnimatedStyle(() => {
    return {
      opacity: navigationIndicatorOpacity.value,
      transform: [{ translateY: navigationIndicatorTranslateY.value }],
    };
  });

  const completionStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: completionScale.value }],
      opacity: completionScale.value,
    };
  });

  const slideStyle = useAnimatedStyle(() => {
    return {
      opacity: slideOpacity.value,
      transform: [{ translateY: slideTranslateY.value }, { scale: slideScale.value }],
    };
  });

  // Show completion screen when all athkar are finished
  if (allCompleted) {
    return (
      <AthkarFocusCompletion
        currentType={currentType}
        athkarCount={currentAthkarList.length}
        completionStyle={completionStyle}
      />
    );
  }

  if (!currentAthkar) {
    return (
      <Box
        flex={1}
        backgroundColor="$background"
        justifyContent="center"
        alignItems="center"
        padding="$6">
        <Text size="lg" color="$typographySecondary" textAlign="center" marginBottom="$4">
          {t("athkar.focus.noAthkar")}
        </Text>
        <Button size="md" action="primary" onPress={() => router.back()}>
          <Text color="$typographyContrast">{t("common.close")}</Text>
        </Button>
      </Box>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Box flex={1} backgroundColor="$background">
        {/* Header */}
        <HStack position="absolute" top={48} end={16} zIndex={20} gap="$2">
          {!showInstructions && (
            <Button
              size="md"
              variant="outline"
              action="default"
              accessibilityLabel={t("athkar.focus.showInstructions")}
              onPress={() => setShowInstructions(true)}
              width={48}
              height={48}
              padding={0}
              borderRadius={999}
              backgroundColor="$backgroundSecondary"
              opacity={0.6}>
              <Icon size="sm" color="$typographySecondary" as={HelpCircle} />
            </Button>
          )}
          <Button
            size="md"
            variant="outline"
            action="default"
            accessibilityLabel={t("common.close")}
            onPress={() => router.back()}
            width={48}
            height={48}
            padding={0}
            borderRadius={999}
            backgroundColor="$backgroundSecondary"
            opacity={0.8}>
            <Icon size="md" color="$typography" as={X} />
          </Button>
        </HStack>

        {/* Progress Indicator */}
        <Box position="absolute" top={48} start={16} end={80} zIndex={5}>
          <Text size="sm" color="$typographySecondary" marginBottom="$2">
            {formatNumberToLocale(`${currentAthkarIndex + 1}`)} /
            {formatNumberToLocale(`${currentAthkarList.length}`)}
          </Text>
          <Progress value={((currentAthkarIndex + 1) / currentAthkarList.length) * 100} size="xs">
            <ProgressFilledTrack backgroundColor="$primary" />
          </Progress>
        </Box>

        {/* Main content area — tap zone (flex fills remaining space above audio controls) */}
        <GestureDetector gesture={combinedGestures}>
          <Pressable
            onPress={handleTap}
            flex={1}
            accessibilityRole="button"
            accessibilityLabel={t("athkar.focus.tapToIncrement")}>
            <Box flex={1} overflow="visible">
              <Box
                flex={1}
                justifyContent="center"
                alignItems="center"
                paddingHorizontal="$8"
                paddingVertical={100}
                overflow="visible">
                <Box width="100%" alignItems="center" overflow="visible">
                  <Animated.View style={[slideStyle, { alignItems: "center", maxWidth: "100%" }]}>
                    <VStack gap="$7" alignItems="center" maxWidth="100%">
                      {/* Circular Progress */}
                      <View style={{ position: "relative", width: 256, height: 256 }}>
                        {/* Background Circle */}
                        <View
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            alignItems: "center",
                            justifyContent: "center",
                          }}>
                          <Svg
                            width={256}
                            height={256}
                            style={{ transform: [{ rotate: "-90deg" }] }}>
                            {/* Background circle */}
                            <Circle
                              cx={128}
                              cy={128}
                              r={CIRCLE_RADIUS}
                              stroke={
                                progressStartColor.startsWith("#")
                                  ? `${progressStartColor}1A`
                                  : "rgba(0,0,0,0.1)"
                              }
                              strokeWidth={8}
                              fill="none"
                            />
                            {/* Progress circle */}
                            <AnimatedCircle
                              cx={128}
                              cy={128}
                              r={CIRCLE_RADIUS}
                              strokeWidth={8}
                              fill="none"
                              strokeDasharray={CIRCLE_CIRCUMFERENCE}
                              strokeLinecap="round"
                              animatedProps={animatedCircleProps}
                            />
                            {/* Audio playback progress ring (inner) */}
                            {audioDuration > 0 && (
                              <Circle
                                cx={128}
                                cy={128}
                                r={AUDIO_RING_RADIUS}
                                stroke={`${theme.primary.val}1A`}
                                strokeWidth={3}
                                fill="none"
                              />
                            )}
                            {audioDuration > 0 && (
                              <AnimatedCircle
                                cx={128}
                                cy={128}
                                r={AUDIO_RING_RADIUS}
                                stroke={theme.primary.val}
                                strokeWidth={3}
                                fill="none"
                                strokeDasharray={AUDIO_RING_CIRCUMFERENCE}
                                strokeLinecap="round"
                                animatedProps={audioCircleProps}
                              />
                            )}
                          </Svg>
                        </View>

                        {/* Counter */}
                        <Animated.View
                          style={[
                            {
                              position: "absolute",
                              top: 0,
                              left: 0,
                              right: 0,
                              bottom: 0,
                              alignItems: "center",
                              justifyContent: "center",
                            },
                            countAnimatedStyle,
                          ]}>
                          <VStack alignItems="center" justifyContent="center" gap="$1">
                            <Text
                              size="5xl"
                              bold
                              color={isCompleted ? "$typographySecondary" : "$info"}>
                              {formatNumberToLocale(`${currentCount}`)}
                            </Text>
                            <Text
                              color="$typographySecondary"
                              style={{
                                lineHeight: 20,
                                includeFontPadding: false,
                              }}>
                              / {formatNumberToLocale(`${totalCount}`)}
                            </Text>
                            {isGrouped && !isCompleted && (
                              <Text
                                size="xs"
                                color="$typographySecondary"
                                style={{ marginTop: 4 }}
                                accessibilityLabel={t("athkar.focus.round", {
                                  current: currentRound,
                                  total: totalRounds,
                                })}>
                                {t("athkar.focus.round", {
                                  current: formatNumberToLocale(`${currentRound}`),
                                  total: formatNumberToLocale(`${totalRounds}`),
                                })}
                              </Text>
                            )}
                            {(playerState === "loading" || playerState === "advancing") && (
                              <Text size="xs" color="$primary" style={{ marginTop: 4 }}>
                                {playerState === "loading"
                                  ? t("athkar.audio.loading")
                                  : t("athkar.audio.nextThikr")}
                              </Text>
                            )}
                          </VStack>
                        </Animated.View>
                      </View>

                      {/* Surah indicator dots for grouped items */}
                      {isGrouped && !isCompleted && groupInfo && (
                        <HStack
                          gap="$2"
                          alignItems="center"
                          justifyContent="center"
                          accessibilityLabel={t(`athkar.group.labels.${currentGroupIndex}`)}>
                          {groupInfo.texts.map((_, index) => (
                            <Box
                              key={index}
                              width={index === currentGroupIndex ? 20 : 8}
                              height={8}
                              borderRadius={4}
                              backgroundColor={
                                index === currentGroupIndex ? "$primary" : "$outline"
                              }
                            />
                          ))}
                        </HStack>
                      )}

                      {/* Athkar Text */}
                      <Animated.View style={[textFadeStyle, { maxWidth: "100%" }]}>
                        <VStack
                          gap="$4"
                          alignItems="center"
                          maxWidth="100%"
                          accessibilityLiveRegion={isGrouped ? "polite" : undefined}>
                          <AthkarTextDisplay
                            textKey={displayTextKey}
                            size="xl"
                            textAlign="center"
                          />
                        </VStack>
                      </Animated.View>
                    </VStack>
                  </Animated.View>
                </Box>
              </Box>

              {/* Instructions - auto hide after 5s, repositioned below progress bar */}
              {!isCompleted && showInstructions && (
                <Animated.View
                  entering={FadeIn}
                  exiting={FadeOut}
                  style={{
                    position: "absolute",
                    top: 100,
                    left: 16,
                    right: 16,
                  }}>
                  <VStack gap="$1">
                    <Text size="sm" color="$typographySecondary" textAlign="center">
                      {t("athkar.focus.tapToIncrement")} •{" "}
                      {t(
                        isRTL
                          ? "athkar.focus.swipeRightToDecrease"
                          : "athkar.focus.swipeLeftToDecrease"
                      )}
                    </Text>
                    <Text size="xs" color="$typographySecondary" textAlign="center">
                      {t("athkar.focus.swipeUpDownToNavigate")}
                    </Text>
                  </VStack>
                </Animated.View>
              )}

              {/* Swipe Indicator */}
              {showSwipeIndicator && currentCount > 0 && (
                <Animated.View
                  style={[
                    swipeIndicatorStyle,
                    { position: "absolute", left: 0, right: 0, top: "50%", alignItems: "center" },
                  ]}>
                  <HStack alignItems="center" gap="$4">
                    <Icon as={ChevronLeft} size="xl" color="$warning" />
                    <Text size="lg" fontWeight="600" color="$warning">
                      {currentCount - 1}
                    </Text>
                    <Icon as={ChevronRight} size="xl" color="$warning" />
                  </HStack>
                </Animated.View>
              )}

              {/* Navigation Indicator */}
              {showNavigationIndicator && (
                <Animated.View
                  style={[
                    navigationIndicatorStyle,
                    { position: "absolute", left: 0, right: 0, top: "50%", alignItems: "center" },
                  ]}>
                  <VStack alignItems="center" gap="$2">
                    <Icon as={ChevronUp} size="lg" color="$info" />
                    <Icon as={ChevronDown} size="lg" color="$info" />
                  </VStack>
                </Animated.View>
              )}
            </Box>
          </Pressable>
        </GestureDetector>

        {/* Audio Controls — bottom strip */}
        {showAudioControls && (
          <AudioControls
            onPlayPause={handlePlayPause}
            onNext={handleAudioNext}
            onPrevious={handleAudioPrevious}
            onStop={audioDismiss}
          />
        )}
      </Box>

      {/* Audio Onboarding Modal */}
      <AudioOnboarding isOpen={showOnboarding} onClose={() => setShowOnboarding(false)} />
    </GestureHandlerRootView>
  );
};

export default AthkarFocusScreen;
