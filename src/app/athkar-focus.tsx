import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { I18nManager, Pressable, Dimensions, View } from "react-native";
import { useRouter } from "expo-router";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  runOnJS,
  FadeIn,
  FadeOut,
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";

// Components
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
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
import { athkarIndexToStartFrom } from "@/utils/athkar";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25;

const AthkarFocusScreen = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const isRTL = I18nManager.isRTL;

  const hapticSelection = useHaptic("selection");
  const hapticSuccess = useHaptic("success");

  const {
    athkarList,
    currentProgress,
    currentAthkarIndex,
    currentType,
    incrementCount,
    decrementCount,
    moveToNext,
    toggleFocusMode,
  } = useAthkarStore();

  // State for showing instructions
  const [showInstructions, setShowInstructions] = useState(true);
  const [showSwipeIndicator, setShowSwipeIndicator] = useState(false);
  const swipeIndicatorOpacity = useSharedValue(0);
  const swipeIndicatorTranslateX = useSharedValue(0);
  const [startFromIndex, setStartFromIndex] = useState(0);

  useEffect(() => {
    const index = athkarIndexToStartFrom(currentProgress, currentType);
    setStartFromIndex(index);
  }, [currentProgress, currentType]);

  // Enable focus mode on mount
  useEffect(() => {
    toggleFocusMode();
    return () => {
      toggleFocusMode();
    };
  }, []);

  // Hide instructions after 10 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowInstructions(false);
    }, 10000);
    return () => clearTimeout(timer);
  }, []);

  // Filter athkar by current type
  const filteredAthkar = athkarList.filter(
    (a) => a.type === currentType || a.type === ATHKAR_TYPE.ALL
  );
  const currentAthkar = filteredAthkar[startFromIndex];
  const progressItem = currentProgress.find(
    (p) => p.athkarId === `${currentAthkar?.id}-${currentType}`
  );
  const currentCount = progressItem?.currentCount || 0;
  const totalCount = currentAthkar?.count || 1;
  const progressPercentage = (currentCount / totalCount) * 100;
  const isCompleted = progressItem?.completed || false;

  // Handle tap to increment
  const handleTap = () => {
    if (!isCompleted && currentAthkar) {
      hapticSelection();
      incrementCount(currentAthkar.id);

      // Check if this tap completes the athkar
      if (currentCount + 1 === totalCount) {
        hapticSuccess();
      }
    }
  };

  const handleNext = () => {
    if (currentAthkarIndex < filteredAthkar.length - 1) {
      moveToNext();
    } else {
      // Last athkar, show completion or exit
      router.back();
    }
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
        runOnJS(hapticSelection)();
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
            <X size={24} className="text-typography" />
          </Button>
        </Box>

        {/* Progress Indicator */}
        <Box className="absolute top-12 left-4 right-20 z-10">
          <Text className="text-sm text-typography-secondary mb-2">
            {currentAthkarIndex + 1} / {filteredAthkar.length}
          </Text>
          <Progress
            value={(currentAthkarIndex / (filteredAthkar.length - 1)) * 100}
            className="h-2">
            <ProgressFilledTrack className="bg-accent-primary" />
          </Progress>
        </Box>

        <GestureDetector gesture={swipeGesture}>
          <Pressable onPress={handleTap} className="flex-1">
            <View style={{ flex: 1 }}>
              <VStack className="flex-1 justify-center items-center px-8" space="2xl">
                {/* Circular Progress */}
                <Box className="relative w-64 h-64">
                  {/* Background Circle */}
                  <Box className="absolute inset-0 items-center justify-center">
                    <Box
                      className={`w-full h-full rounded-full border-8 ${isCompleted ? "border-accent-success/30" : "border-background-secondary"}`}
                    />
                  </Box>

                  {/* Progress Circle using SVG */}
                  <View className="absolute inset-0 items-center justify-center">
                    <Svg width={256} height={256} style={{ transform: [{ rotate: "-90deg" }] }}>
                      <Circle
                        cx={128}
                        cy={128}
                        r={120}
                        stroke={isCompleted ? "#10b981" : "#6366f1"}
                        strokeWidth={8}
                        fill="none"
                        strokeDasharray={2 * Math.PI * 120}
                        strokeDashoffset={2 * Math.PI * 120 * (1 - progressPercentage / 100)}
                        strokeLinecap="round"
                      />
                    </Svg>
                  </View>

                  {/* Counter  */}
                  <View className="absolute inset-0 items-center justify-center">
                    <VStack className="items-center justify-center" space="xs">
                      <Text
                        className={`text-5xl font-bold ${
                          isCompleted ? "text-accent-success" : "text-typography"
                        }`}
                        style={{
                          lineHeight: 60,
                          textAlignVertical: "center",
                          includeFontPadding: false,
                        }}>
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
                  </View>
                </Box>

                {/* Next Button when completed */}
                {isCompleted && (
                  <Button size="lg" onPress={handleNext} className="bg-accent-success mt-4">
                    <ButtonText className="text-white font-semibold">
                      {currentAthkarIndex === filteredAthkar.length - 1
                        ? t("athkar.focus.finish")
                        : t("athkar.focus.next")}
                    </ButtonText>
                  </Button>
                )}

                {/* Athkar Text */}
                <VStack space="lg" className="items-center max-w-full">
                  <Text className="text-xl font-semibold text-center text-typography">
                    {t(currentAthkar.title)}
                  </Text>
                  <Text
                    className="text-lg text-center text-typography leading-relaxed"
                    style={{ textAlign: "center", writingDirection: isRTL ? "rtl" : "ltr" }}>
                    {t(currentAthkar.text)}
                  </Text>
                </VStack>

                {/* Instructions - auto hide after 10s */}
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
                      <ChevronLeft size={40} className="text-accent-primary/50" />
                      <Text className="text-lg font-semibold text-accent-primary/50">
                        {currentCount - 1}
                      </Text>
                      <ChevronRight size={40} className="text-accent-primary/50" />
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
