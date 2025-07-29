import { useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  runOnJS,
  cancelAnimation,
  useAnimatedReaction,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

// Components
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Progress, ProgressFilledTrack } from "@/components/ui/progress";
import { Button, ButtonText } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

import AthkarCard from "@/components/athkar/AthkarCard";

// Store
import { useAthkarStore } from "@/stores/athkar";

// Types
import type { AthkarType } from "@/types/athkar";

// Icons
import { RotateCcw, Flame, Trophy } from "lucide-react-native";

// Constants
import { ATHKAR_TYPE } from "@/constants/Athkar";

// Utils
import { formatNumberToLocale } from "@/utils/number";

// Hooks
import { useHaptic } from "@/hooks/useHaptic";
import { I18nManager } from "react-native";

type Props = {
  type: AthkarType;
};

const AthkarList = ({ type }: Props) => {
  const { t } = useTranslation();
  const {
    athkarList,
    currentProgress,
    streak,
    settings,
    initializeSession,
    resetProgress,
    checkAndResetIfNewDay,
  } = useAthkarStore();

  const filteredAthkar = athkarList
    .filter((athkar) => athkar.type === type || athkar.type === ATHKAR_TYPE.ALL)
    .sort((a, b) => a.order - b.order);

  useEffect(() => {
    const hasSessionForType = currentProgress.some((p) => p.athkarId.includes(`-${type}`));
    if (!hasSessionForType && filteredAthkar.length > 0) {
      initializeSession(type as Exclude<AthkarType, "all">);
    }
  }, [type, filteredAthkar.length, currentProgress, initializeSession]);

  // Haptic feedback hooks
  const hapticLight = useHaptic("light");
  const hapticSuccess = useHaptic("success");
  const hapticSelection = useHaptic("selection");

  // Press and hold state
  const [isPressing, setIsPressing] = useState(false);
  const [pressProgress, setPressProgress] = useState(0);

  const hapticTimer = useRef<number | null>(null);
  const resetTimer = useRef<number | null>(null);
  const animationControl = useRef<{ value: boolean }>({ value: false });

  // Reanimated shared values
  const progress = useSharedValue(0);
  const backgroundProgress = useSharedValue(0);
  const scaleValue = useSharedValue(1);

  useEffect(() => {
    checkAndResetIfNewDay();
  }, [checkAndResetIfNewDay]);

  // Calculate overall progress for streak
  const totalAthkar = filteredAthkar.length;
  const completedAthkar = currentProgress.filter(
    (p) => p.completed && p.athkarId.includes(`-${type}`)
  ).length;

  const overallProgress = totalAthkar > 0 ? (completedAthkar / totalAthkar) * 100 : 0;

  // Get actual streak data from store
  const streakDays = streak.currentStreak;
  const longestStreak = streak.longestStreak || 0;

  // Clean up timers
  const clearTimers = () => {
    if (hapticTimer.current) {
      clearInterval(hapticTimer.current);
      hapticTimer.current = null;
    }
    if (resetTimer.current) {
      clearTimeout(resetTimer.current);
      resetTimer.current = null;
    }
  };

  // Handle press end
  const handlePressEnd = () => {
    // Stop the animation loop
    if (animationControl.current) {
      animationControl.current.value = false;
    }

    setIsPressing(false);
    setPressProgress(0);
    clearTimers();

    // Cancel and reset animations
    cancelAnimation(progress);
    cancelAnimation(backgroundProgress);
    cancelAnimation(scaleValue);

    progress.value = withTiming(0, { duration: 200 });
    backgroundProgress.value = withTiming(0, { duration: 200 });
    scaleValue.value = withTiming(1, { duration: 100 });
  };

  // Handle completion
  const handleCompletion = () => {
    hapticSuccess();
    resetProgress();
    handlePressEnd();
  };

  useAnimatedReaction(
    () => progress.value,
    (current, previous) => {
      if (current >= 100 && (previous ?? 0) < 100) {
        runOnJS(handleCompletion)();
      }
    }
  );

  // Handle press start
  const handlePressStart = () => {
    setIsPressing(true);
    setPressProgress(0);

    // Initial haptic feedback
    hapticSelection();

    // Start animations
    progress.value = withTiming(100, { duration: 3000 });
    backgroundProgress.value = withTiming(1, { duration: 3000 });
    scaleValue.value = withTiming(0.95, { duration: 100 });

    // Use a ref to track if we should continue the animation
    const shouldContinue = { value: true };

    // Set up progress tracking for display
    const startTime = Date.now();
    const updateProgress = () => {
      const elapsed = Date.now() - startTime;
      const progressPercent = Math.min((elapsed / 3000) * 100, 100);

      setPressProgress(progressPercent);

      // Check if we should continue based on the ref, not state
      if (progressPercent < 100 && shouldContinue.value) {
        requestAnimationFrame(updateProgress);
      }
    };
    updateProgress();

    animationControl.current = shouldContinue;

    // Haptic feedback every 500ms
    hapticTimer.current = setInterval(() => {
      hapticLight();
    }, 500);

    resetTimer.current = setTimeout(() => {
      if (shouldContinue.value) {
        handleCompletion();
      }
    }, 3100);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimers();
      cancelAnimation(progress);
      cancelAnimation(backgroundProgress);
      cancelAnimation(scaleValue);
    };
  }, [progress, backgroundProgress, scaleValue]);

  // Gesture handler
  const longPressGesture = Gesture.Pan()
    .onBegin(() => {
      runOnJS(handlePressStart)();
    })
    .onFinalize(() => {
      runOnJS(handlePressEnd)();
    });

  // Animated styles
  const buttonAnimatedStyle = useAnimatedStyle(() => {
    const backgroundColor = interpolate(backgroundProgress.value, [0, 1], [0x3b82f6, 0x3b82f6]);

    // Convert hex to rgba
    const r = (backgroundColor >> 16) & 255;
    const g = (backgroundColor >> 8) & 255;
    const b = backgroundColor & 255;

    return {
      backgroundColor: `rgb(${r}, ${g}, ${b})`,
      transform: [{ scale: scaleValue.value }],
    };
  });

  const progressOverlayStyle = useAnimatedStyle(() => {
    const width = interpolate(progress.value, [0, 100], [0, 1]);

    return {
      position: "absolute" as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(255, 255, 255, 0.2)",
      transform: [{ scaleX: width }],
      transformOrigin: I18nManager.isRTL ? "left" : "right",
    };
  });

  return (
    <VStack space="md">
      {/* Streak Card */}
      {settings.showStreak && (
        <Card className="p-4 bg-background-secondary dark:bg-background-tertiary">
          <HStack className="justify-between items-center mb-4">
            <VStack space="md" className="flex-1">
              <HStack className="justify-between items-center">
                <HStack space="sm" className="items-center">
                  <Icon as={Flame} size="sm" className="text-accent-info" />
                  <Text className="text-sm text-typography-secondary">
                    {t("athkar.dailyStreak")}
                  </Text>
                  <Text className="text-sm font-medium text-typography">
                    {t("athkar.day", {
                      count: streakDays,
                      value: formatNumberToLocale(`${streakDays}`),
                    })}
                  </Text>
                </HStack>

                <HStack space="sm" className="items-center">
                  <Icon as={Trophy} size="sm" className="text-orange-500" />
                  <Text className="text-sm text-orange-500">{t("athkar.streak.best")}</Text>

                  <Text className="text-sm font-medium text-typography">
                    {t("athkar.day", {
                      count: longestStreak,
                      value: formatNumberToLocale(`${longestStreak}`),
                    })}
                  </Text>
                </HStack>
              </HStack>
            </VStack>
          </HStack>

          <Text className="text-left text-sm text-typography-secondary">
            {t("athkar.todayProgress")}
          </Text>
          <Progress
            value={overallProgress}
            className="h-3 bg-background-tertiary dark:bg-background mt-2">
            <ProgressFilledTrack className="bg-accent-info" />
          </Progress>
          <Text className="text-xs text-typography-secondary mt-2 text-right">
            {formatNumberToLocale(`${Math.round(overallProgress)}`)}%
          </Text>
        </Card>
      )}

      {/* Athkar Cards */}
      {filteredAthkar.map((athkar) => {
        const progress = currentProgress.find((p) => p.athkarId === `${athkar.id}-${type}`);

        const currentCount = progress?.currentCount || 0;
        const isCompleted = progress?.completed || false;

        return (
          <AthkarCard
            key={athkar.id}
            athkar={athkar}
            progress={{ current: currentCount, total: athkar.count, completed: isCompleted }}
          />
        );
      })}

      {/* Press and Hold Reset Button */}
      <GestureDetector gesture={longPressGesture}>
        <Animated.View
          style={[
            {
              borderRadius: 8,
              overflow: "hidden",
              position: "relative",
            },
            buttonAnimatedStyle,
          ]}>
          <Button
            size="md"
            variant="outline"
            className="w-full border-0"
            style={{ backgroundColor: "transparent" }}>
            <Icon size="md" className="text-white" as={RotateCcw} />
            <ButtonText className="text-white font-medium">
              {isPressing
                ? t("common.holdToReset", {
                    progress: formatNumberToLocale(`${Math.round(pressProgress)}`),
                  })
                : t("common.resetDailyProgress")}
            </ButtonText>
          </Button>

          {/* Progress overlay */}
          {isPressing && <Animated.View style={progressOverlayStyle} pointerEvents="none" />}
        </Animated.View>
      </GestureDetector>
    </VStack>
  );
};

export default AthkarList;
