import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Dimensions, View } from "react-native";
import { useRouter } from "expo-router";
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
import { X, ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from "lucide-react-native";

// Stores
import { useAthkarStore } from "@/stores/athkar";

// Constants
import { ATHKAR_TYPE } from "@/constants/Athkar";

// Hooks
import { useHaptic } from "@/hooks/useHaptic";

// Utils
import { formatNumberToLocale } from "@/utils/number";
import { Icon } from "@/components/ui/icon";

// Components
import { AthkarFocusCompletion } from "@/components/athkar/AthkarFocusCompletion";

// Contexts
import { useRTL } from "@/contexts/RTLContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25;

// Create animated Circle component
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const AthkarFocusScreen = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const { isRTL } = useRTL();

  const hapticSelection = useHaptic("selection");
  const hapticSuccess = useHaptic("success");
  const hapticWarning = useHaptic("warning");

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

  // Hide instructions after 3 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowInstructions(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  // Get current athkar and progress using store's currentAthkarIndex
  const currentAthkar = currentAthkarList[currentAthkarIndex];

  const progressItem = currentProgress.find((p) => p.athkarId === currentAthkar?.id);

  const currentCount = progressItem?.currentCount || 0;
  const totalCount = progressItem?.totalCount || currentAthkar?.count || 1;
  const progressPercentage = (currentCount / totalCount) * 100;

  // Sync with store's currentAthkarIndex changes (auto-move functionality)
  useEffect(() => {
    // Re-animate progress when index changes due to auto-move
    if (currentAthkar) {
      animatedProgress.value = withSpring(progressPercentage / 100, {
        damping: 15,
        stiffness: 150,
        mass: 1,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentAthkarIndex, currentAthkar, progressPercentage]);

  // Track previous index for slide direction
  const [previousIndex, setPreviousIndex] = useState(currentAthkarIndex);

  useEffect(() => {
    if (previousIndex !== currentAthkarIndex) {
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

  // Animate completion celebration when all athkar are done
  useEffect(() => {
    if (allCompleted) {
      // Celebration animation
      completionScale.value = withSpring(1, { damping: 15, stiffness: 200 });

      // Add extra haptic feedback for completion
      setTimeout(() => hapticSuccess(), 100);
      setTimeout(() => hapticSuccess(), 300);
      setTimeout(() => hapticSuccess(), 500);
    } else {
      completionScale.value = withTiming(0, { duration: 200 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allCompleted]);

  // Animate progress when count changes
  useEffect(() => {
    animatedProgress.value = withSpring(progressPercentage / 100, {
      damping: 15,
      stiffness: 150,
      mass: 1,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progressPercentage]);

  // Circle constants
  const CIRCLE_RADIUS = 120;
  const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS;

  // Animated props for the progress circle
  const animatedCircleProps = useAnimatedProps(() => {
    const strokeDashoffset = CIRCLE_CIRCUMFERENCE * (1 - animatedProgress.value);

    return {
      strokeDashoffset,
      stroke: interpolateColor(
        animatedProgress.value,
        [0, 1],
        ["#1E40AF", "#10b981"] // Blue to green
      ),
    };
  });

  // Animated style for count text
  const countAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: countOpacity.value,
      transform: [{ scale: countOpacity.value }],
    };
  });

  // Handle tap to increment
  const handleTap = () => {
    if (!isCompleted && currentAthkar) {
      hapticSelection();

      // Animate circle scale for feedback
      circleScale.value = withSpring(1.05, { damping: 20, stiffness: 300 }, () => {
        circleScale.value = withSpring(1, { damping: 20, stiffness: 300 });
      });

      // Animate count text
      countOpacity.value = withTiming(0.7, { duration: 100 }, () => {
        countOpacity.value = withTiming(1, { duration: 100 });
      });

      incrementCount(currentAthkar.id);

      // Check if this tap completes the athkar
      if (currentCount + 1 === totalCount) {
        hapticSuccess();
        // Add completion animation
        circleScale.value = withSpring(1.1, { damping: 15, stiffness: 200 }, () => {
          circleScale.value = withSpring(1, { damping: 15, stiffness: 200 });
        });
      }
    }
  };

  // Handle horizontal swipe for decrement
  const horizontalSwipe = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .failOffsetY([-30, 30])
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
    .failOffsetX([-30, 30])
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
    return null;
  }

  return (
    <GestureHandlerRootView className="flex-1">
      <Box className="flex-1 bg-background">
        {/* Header */}
        <Box className="absolute top-12 right-4 z-10">
          <Button
            size="md"
            variant="outline"
            onPress={() => router.back()}
            className="w-12 h-12 p-0 rounded-full bg-background-secondary/80">
            <Icon size="md" className="text-typography" as={X} />
          </Button>
        </Box>

        {/* Progress Indicator */}
        <Box className="absolute top-12 left-4 right-20 z-10">
          <Text className="text-sm text-typography-secondary mb-2">
            {formatNumberToLocale(`${currentAthkarIndex + 1}`)} /
            {formatNumberToLocale(`${currentAthkarList.length}`)}
          </Text>
          <Progress
            value={((currentAthkarIndex + 1) / currentAthkarList.length) * 100}
            className="h-2">
            <ProgressFilledTrack className="bg-accent-primary" />
          </Progress>
        </Box>

        <GestureDetector gesture={combinedGestures}>
          <Pressable onPress={handleTap} className="flex-1">
            <Box style={{ flex: 1, overflow: "visible" }}>
              <Box
                style={{
                  flex: 1,
                  justifyContent: "center",
                  alignItems: "center",
                  paddingHorizontal: 32,
                  paddingVertical: 100,
                  overflow: "visible",
                }}>
                <Box style={{ width: "100%", alignItems: "center", overflow: "visible" }}>
                  <Animated.View style={slideStyle} className="items-center max-w-full">
                    <VStack space="2xl" className="items-center max-w-full">
                      {/* Circular Progress */}
                      <View style={{ position: "relative", width: 256, height: 256 }}>
                        {/* Background Circle */}
                        <View className="absolute inset-0 items-center justify-center">
                          <Svg
                            width={256}
                            height={256}
                            style={{ transform: [{ rotate: "-90deg" }] }}>
                            {/* Background circle */}
                            <Circle
                              cx={128}
                              cy={128}
                              r={CIRCLE_RADIUS}
                              stroke="rgba(30, 64, 175, 0.1)"
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
                          </Svg>
                        </View>

                        {/* Counter */}
                        <Animated.View
                          style={[
                            {
                              position: "absolute",
                              inset: 0,
                              alignItems: "center",
                              justifyContent: "center",
                            },
                            countAnimatedStyle,
                          ]}>
                          <VStack className="items-center justify-center" space="xs">
                            <Text
                              className={`text-5xl font-bold ${
                                isCompleted ? "text-typography-secondary" : "text-accent-info"
                              }`}>
                              {formatNumberToLocale(`${currentCount}`)}
                            </Text>
                            <Text
                              className="text-typography-secondary"
                              style={{
                                lineHeight: 20,
                                includeFontPadding: false,
                              }}>
                              / {formatNumberToLocale(`${totalCount}`)}
                            </Text>
                          </VStack>
                        </Animated.View>
                      </View>

                      {/* Athkar Text */}
                      <VStack space="lg" className="items-center max-w-full">
                        <Text className="text-xl text-center text-typography leading-relaxed ">
                          {t(currentAthkar.text)}
                        </Text>
                      </VStack>
                    </VStack>
                  </Animated.View>
                </Box>
              </Box>

              {/* Instructions - auto hide after 3s */}
              {!isCompleted && showInstructions && (
                <Animated.View
                  entering={FadeIn}
                  exiting={FadeOut}
                  className="absolute bottom-20 left-4 right-4">
                  <VStack space="xs">
                    <Text className="text-sm text-typography-secondary text-center">
                      {t("athkar.focus.tapToIncrement")} •{" "}
                      {t(
                        isRTL
                          ? "athkar.focus.swipeRightToDecrease"
                          : "athkar.focus.swipeLeftToDecrease"
                      )}
                    </Text>
                    <Text className="text-xs text-typography-secondary text-center">
                      {t("athkar.focus.swipeUpDownToNavigate")}
                    </Text>
                  </VStack>
                </Animated.View>
              )}

              {/* Swipe Indicator */}
              {showSwipeIndicator && currentCount > 0 && (
                <Animated.View
                  style={[swipeIndicatorStyle]}
                  className="absolute left-0 right-0 top-1/2 items-center">
                  <HStack className="items-center" space="lg">
                    <Icon as={ChevronLeft} size="xl" className="text-warning" />
                    <Text className="text-lg font-semibold text-warning">{currentCount - 1}</Text>
                    <Icon as={ChevronRight} size="xl" className="text-warning" />
                  </HStack>
                </Animated.View>
              )}

              {/* Navigation Indicator */}
              {showNavigationIndicator && (
                <Animated.View
                  style={[navigationIndicatorStyle]}
                  className="absolute left-0 right-0 top-1/2 items-center">
                  <VStack className="items-center" space="sm">
                    <Icon as={ChevronUp} size="lg" className="text-accent-info" />
                    <Icon as={ChevronDown} size="lg" className="text-accent-info" />
                  </VStack>
                </Animated.View>
              )}
            </Box>
          </Pressable>
        </GestureDetector>
      </Box>
    </GestureHandlerRootView>
  );
};

export default AthkarFocusScreen;
