import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { I18nManager, Dimensions, View } from "react-native";
import { useRouter } from "expo-router";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  runOnJS,
  FadeIn,
  FadeOut,
  useAnimatedProps,
  withSpring,
  interpolateColor,
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";

// Components
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Button, ButtonText } from "@/components/ui/button";
import { Progress, ProgressFilledTrack } from "@/components/ui/progress";
import { X, ChevronLeft, ChevronRight } from "lucide-react-native";

// Stores
import { useAthkarStore } from "@/stores/athkar";

// Constants
import { ATHKAR_TYPE } from "@/constants/Athkar";

// Hooks
import { useHaptic } from "@/hooks/useHaptic";

// Utils
import { formatNumberToLocale } from "@/utils/number";
import { Icon } from "@/components/ui/icon";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25;

// Create animated Circle component
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const AthkarFocusScreen = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const isRTL = I18nManager.isRTL;

  const hapticSelection = useHaptic("selection");
  const hapticSuccess = useHaptic("success");
  const hapticWarning = useHaptic("warning");

  const {
    morningAthkarList,
    eveningAthkarList,
    currentProgress,
    currentType,
    incrementCount,
    decrementCount,
    toggleFocusMode,
    currentAthkarIndex,
  } = useAthkarStore();

  // State for showing instructions
  const [showInstructions, setShowInstructions] = useState(true);
  const [showSwipeIndicator, setShowSwipeIndicator] = useState(false);
  const swipeIndicatorOpacity = useSharedValue(0);
  const swipeIndicatorTranslateX = useSharedValue(0);

  // Animated values for circle progress
  const animatedProgress = useSharedValue(0);
  const circleScale = useSharedValue(1);
  const countOpacity = useSharedValue(1);

  // Get current athkar list based on type
  const currentAthkarList =
    currentType === ATHKAR_TYPE.MORNING ? morningAthkarList : eveningAthkarList;

  // Enable focus mode on mount
  useEffect(() => {
    toggleFocusMode();
    return () => {
      toggleFocusMode();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hide instructions after 3 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowInstructions(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  // Get current athkar and progress
  const currentAthkar = currentAthkarList[currentAthkarIndex];

  const progressItem = currentProgress.find((p) => p.athkarId === currentAthkar?.id);

  const currentCount = progressItem?.currentCount || 0;
  const totalCount = progressItem?.totalCount || currentAthkar?.count || 1;
  const progressPercentage = (currentCount / totalCount) * 100;
  const isCompleted = progressItem?.completed || false;

  // Check if all athkars in current session are completed
  const allCompleted = currentProgress
    .filter((p) => p.athkarId.includes(`-${currentType}`))
    .every((p) => p.completed);

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

  // Animated style for circle scale effect
  const circleAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: circleScale.value }],
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

  const handleFinish = () => {
    router.back();
  };

  // Handle swipe gestures
  const swipeGesture = Gesture.Pan()
    .onStart(() => {
      runOnJS(setShowSwipeIndicator)(true);
      swipeIndicatorOpacity.value = withTiming(1, { duration: 200 });
    })
    .onUpdate((event) => {
      // Show swipe indicator movement
      swipeIndicatorTranslateX.value = event.translationX * 0.3; // Move indicator less than actual swipe
    })
    .onEnd((event) => {
      const shouldDecrease = isRTL
        ? event.translationX > SWIPE_THRESHOLD
        : event.translationX < -SWIPE_THRESHOLD;

      if (shouldDecrease && currentCount > 0 && currentAthkar) {
        runOnJS(hapticWarning)();

        // Animate circle scale for decrement feedback
        circleScale.value = withSpring(0.95, { damping: 20, stiffness: 300 }, () => {
          circleScale.value = withSpring(1, { damping: 20, stiffness: 300 });
        });

        // Animate count text
        countOpacity.value = withTiming(0.7, { duration: 100 }, () => {
          countOpacity.value = withTiming(1, { duration: 100 });
        });

        runOnJS(decrementCount)(currentAthkar.id);
      }

      // Hide swipe indicator
      swipeIndicatorOpacity.value = withTiming(0, { duration: 200 });
      swipeIndicatorTranslateX.value = withTiming(0, { duration: 200 });
      runOnJS(setShowSwipeIndicator)(false);
    });

  const swipeIndicatorStyle = useAnimatedStyle(() => {
    return {
      opacity: swipeIndicatorOpacity.value,
      transform: [{ translateX: swipeIndicatorTranslateX.value }],
    };
  });

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

        <GestureDetector gesture={swipeGesture}>
          <Pressable onPress={handleTap} className="flex-1">
            <View style={{ flex: 1 }}>
              <VStack className="flex-1 justify-center items-center px-8" space="2xl">
                {/* Animated Circular Progress */}
                <Animated.View
                  style={[{ position: "relative", width: 256, height: 256 }, circleAnimatedStyle]}>
                  {/* Background Circle */}
                  <View className="absolute inset-0 items-center justify-center">
                    <Svg width={256} height={256} style={{ transform: [{ rotate: "-90deg" }] }}>
                      {/* Background circle */}
                      <Circle
                        cx={128}
                        cy={128}
                        r={CIRCLE_RADIUS}
                        stroke="rgba(30, 64, 175, 0.1)"
                        strokeWidth={8}
                        fill="none"
                      />
                      {/* Animated progress circle */}
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

                  {/* Animated Counter */}
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
                </Animated.View>

                {/* Finish Button when all completed */}
                {allCompleted && (
                  <Button size="lg" onPress={handleFinish} className="bg-success mt-4">
                    <ButtonText className="text-white font-semibold">
                      {t("athkar.focus.allCompleted", {
                        type: t(`athkar.${currentType}`),
                      })}
                    </ButtonText>
                  </Button>
                )}

                {/* Athkar Text */}
                <VStack space="lg" className="items-center max-w-full">
                  <Text className="text-xl text-center text-typography leading-relaxed ">
                    {t(currentAthkar.text)}
                  </Text>
                </VStack>

                {/* Instructions - auto hide after 3s */}
                {!isCompleted && showInstructions && (
                  <Animated.View
                    entering={FadeIn}
                    exiting={FadeOut}
                    className="absolute bottom-20 left-4 right-4">
                    <Text className="text-sm text-typography-secondary text-center">
                      {t("athkar.focus.tapToIncrement")} •{" "}
                      {t(
                        isRTL
                          ? "athkar.focus.swipeRightToDecrease"
                          : "athkar.focus.swipeLeftToDecrease"
                      )}
                    </Text>
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
              </VStack>
            </View>
          </Pressable>
        </GestureDetector>
      </Box>
    </GestureHandlerRootView>
  );
};

export default AthkarFocusScreen;
