import { useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useTheme } from "tamagui";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  cancelAnimation,
  useAnimatedReaction,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { scheduleOnRN } from "react-native-worklets";

// Components
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Spinner } from "@/components/ui/spinner";
import { Progress, ProgressFilledTrack } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

import AthkarCard from "@/components/athkar/AthkarCard";

// Store
import { useAthkarStore } from "@/stores/athkar";

// Types
import type { AthkarType } from "@/types/athkar";

// Icons
import { RotateCcw, Flame, Trophy } from "lucide-react-native";

// Utils
import { formatNumberToLocale } from "@/utils/number";

// Hooks
import { useHaptic } from "@/hooks/useHaptic";

// Contexts
import { useRTL } from "@/contexts/RTLContext";

// Constants
import { ATHKAR_TYPE } from "@/constants/Athkar";

type Props = {
  type: AthkarType;
};

const AthkarList = ({ type }: Props) => {
  const { t } = useTranslation();
  const { isRTL } = useRTL();
  const theme = useTheme();
  const {
    morningAthkarList,
    eveningAthkarList,
    currentProgress,
    streak,
    settings,
    initializeSession,
    resetProgress,
  } = useAthkarStore();

  // Loading states
  const [isInitializing, setIsInitializing] = useState(true);
  const [isResetting, setIsResetting] = useState(false);

  // Get the correct athkar list based on type
  const currentAthkarList = type === ATHKAR_TYPE.MORNING ? morningAthkarList : eveningAthkarList;

  useEffect(() => {
    const initialize = async () => {
      setIsInitializing(true);
      try {
        await initializeSession(type as Exclude<AthkarType, "all">);
      } finally {
        setIsInitializing(false);
      }
    };

    initialize();
  }, [type, initializeSession]);

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

  // Calculate overall progress
  const totalAthkar = currentAthkarList.length;
  const completedAthkar = currentProgress.filter(
    (p) => p.completed && p.athkarId.includes(`-${type}`)
  ).length;

  const overallProgress = totalAthkar > 0 ? (completedAthkar / totalAthkar) * 100 : 0;

  // Get streak data from store
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

  // Handle completion - trigger reset
  const handleCompletion = async () => {
    hapticSuccess();
    handlePressEnd();

    // Reset the current session with loading state
    setIsResetting(true);
    try {
      await resetProgress();
    } finally {
      setIsResetting(false);
    }
  };

  useAnimatedReaction(
    () => progress.value,
    (current, previous) => {
      if (current >= 100 && (previous ?? 0) < 100) {
        scheduleOnRN(handleCompletion);
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
      scheduleOnRN(handlePressStart);
    })
    .onFinalize(() => {
      scheduleOnRN(handlePressEnd);
    });

  // Animated styles
  const resetButtonColor = theme.info.val;
  const buttonAnimatedStyle = useAnimatedStyle(() => {
    return {
      backgroundColor: resetButtonColor,
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
      transformOrigin: isRTL ? "left" : "right",
    };
  });

  // Show loading indicator while initializing
  if (isInitializing) {
    return (
      <VStack flex={1} justifyContent="center" alignItems="center" gap="$3">
        <Spinner size="large" />
        <Text color="$typographySecondary">{t("athkar.loading.initializing")}</Text>
      </VStack>
    );
  }

  return (
    <VStack gap="$3" position="relative">
      {/* Show loading overlay while resetting */}
      {isResetting && (
        <VStack
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          backgroundColor="$background"
          opacity={0.8}
          justifyContent="center"
          alignItems="center"
          zIndex={50}
          gap="$3">
          <Spinner size="large" />
          <Text color="$typographySecondary">{t("athkar.loading.resetting")}</Text>
        </VStack>
      )}
      {/* Streak Card */}
      {settings.showStreak && (
        <Card padding="$4" backgroundColor="$backgroundSecondary">
          <HStack justifyContent="space-between" alignItems="center" marginBottom="$4">
            <VStack gap="$3" flex={1}>
              <HStack justifyContent="space-between" alignItems="center">
                <HStack gap="$2" alignItems="center">
                  <Icon as={Flame} size="sm" color="$info" />
                  <Text size="sm" color="$typographySecondary">
                    {t("athkar.dailyStreak")}
                  </Text>
                  <Text size="sm" fontWeight="500" color="$typography">
                    {t("athkar.day", {
                      count: streakDays,
                      value: formatNumberToLocale(`${streakDays}`),
                    })}
                  </Text>
                </HStack>

                <HStack gap="$2" alignItems="center">
                  <Icon as={Trophy} size="sm" color="$warning" />
                  <Text size="sm" color="$warning">
                    {t("athkar.streak.best")}
                  </Text>

                  <Text size="sm" fontWeight="500" color="$typography">
                    {t("athkar.day", {
                      count: longestStreak,
                      value: formatNumberToLocale(`${longestStreak}`),
                    })}
                  </Text>
                </HStack>
              </HStack>
            </VStack>
          </HStack>

          <Text size="sm" color="$typographySecondary">
            {t("athkar.todayProgress")}
          </Text>
          <Progress
            value={overallProgress}
            size="md"
            backgroundColor="$backgroundMuted"
            marginTop="$2">
            <ProgressFilledTrack backgroundColor="$info" />
          </Progress>
          <Text size="xs" color="$typographySecondary" marginTop="$2">
            {formatNumberToLocale(`${Math.round(overallProgress)}`)}%
          </Text>
        </Card>
      )}
      {/* Athkar Cards */}
      {currentAthkarList.map((athkar) => {
        // Find progress using the athkar ID
        const progressItem = currentProgress.find((p) => p.athkarId === athkar.id);

        const currentCount = progressItem?.currentCount || 0;
        const totalCount = progressItem?.totalCount || athkar.count;
        const isCompleted = progressItem?.completed || false;

        return (
          <AthkarCard
            key={athkar.id}
            athkar={athkar}
            progress={{
              current: currentCount,
              total: totalCount,
              completed: isCompleted,
            }}
          />
        );
      })}
      {/* Press and Hold Reset Button */}
      <GestureDetector gesture={longPressGesture}>
        <Animated.View
          style={[
            {
              borderRadius: 8,
              position: "relative",
            },
            buttonAnimatedStyle,
          ]}>
          <Button
            size="md"
            variant="outline"
            action="default"
            width="100%"
            borderWidth={0}
            backgroundColor="transparent"
            disabled={isResetting}>
            {isResetting ? (
              <Spinner size="small" />
            ) : (
              <Icon as={RotateCcw} size="md" color="$typographyContrast" />
            )}
            <Button.Text color="$typographyContrast" fontWeight="500">
              {isResetting
                ? t("athkar.loading.resetting")
                : isPressing
                  ? t("common.holdToReset", {
                      progress: formatNumberToLocale(`${Math.round(pressProgress)}`),
                    })
                  : t("common.resetDailyProgress")}
            </Button.Text>
          </Button>

          {/* Progress overlay */}
          {isPressing && !isResetting && (
            <Animated.View style={progressOverlayStyle} pointerEvents="none" />
          )}
        </Animated.View>
      </GestureDetector>
    </VStack>
  );
};

export default AthkarList;
