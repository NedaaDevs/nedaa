import { useEffect, useState, useRef } from "react";
import { ScrollView, I18nManager } from "react-native";
import { useTranslation } from "react-i18next";
import { GestureHandlerRootView, GestureDetector, Gesture } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  withTiming,
  cancelAnimation,
  useAnimatedStyle,
  interpolate,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

// Components
import { Background } from "@/components/ui/background";
import TopBar from "@/components/TopBar";
import { SwipeableEntry } from "@/components/Qada/SwipeableEntry";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { Progress, ProgressFilledTrack } from "@/components/ui/progress";
import { Pressable } from "@/components/ui/pressable";
import { Icon } from "@/components/ui/icon";
import { Spinner } from "@/components/ui/spinner";
import {
  Modal,
  ModalBackdrop,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
} from "@/components/ui/modal";

// Stores
import { useQadaStore } from "@/stores/qada";

// Icons
import { Plus, Check, X, CalendarDays, RotateCcw } from "lucide-react-native";

// Hooks
import { useHaptic } from "@/hooks/useHaptic";

const QadaScreen = () => {
  const { t } = useTranslation();
  const {
    totalMissed,
    totalCompleted,
    totalOriginal,
    pendingEntries,
    isLoading,
    loadData,
    addMissed,
    completeEntry,
    completeAllEntries,
    deleteEntry,
    resetAll,
    getRemaining,
    getCompletionPercentage,
  } = useQadaStore();

  const [showAddModal, setShowAddModal] = useState(false);
  const [amount, setAmount] = useState(1);

  // Reset press and hold state
  const [isResetting, setIsResetting] = useState(false);
  const [resetProgress, setResetProgress] = useState(0);
  const [isPressing, setIsPressing] = useState(false);
  const progress = useSharedValue(0);
  const backgroundProgress = useSharedValue(0);
  const scaleValue = useSharedValue(1);
  const animationControl = useRef<{ value: boolean } | null>(null);
  const hapticTimer = useRef<number | null>(null);
  const resetTimer = useRef<number | null>(null);

  // Stepper long press state
  const incrementTimer = useRef<number | null>(null);
  const decrementTimer = useRef<number | null>(null);

  const hapticSelection = useHaptic("selection");
  const hapticSuccess = useHaptic("success");
  const hapticWarning = useHaptic("warning");
  const hapticLight = useHaptic("light");

  const remaining = getRemaining();
  const completionPercentage = getCompletionPercentage();

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleQuickAdd = async (days: number) => {
    await hapticSelection();
    await addMissed(days);
    setShowAddModal(false);
    await hapticSuccess();
  };

  const handleAddMissed = async () => {
    if (amount <= 0) return;
    await addMissed(amount);
    setAmount(1);
    setShowAddModal(false);
    await hapticSuccess();
  };

  const incrementAmount = () => {
    setAmount((prev) => Math.min(prev + 1, 999));
  };

  const decrementAmount = () => {
    setAmount((prev) => Math.max(prev - 1, 1));
  };

  const startIncrement = () => {
    hapticLight();
    incrementAmount();
    // Start with slower interval, then speed up
    let interval = 200;
    let count = 0;
    incrementTimer.current = window.setInterval(() => {
      count++;
      // Speed up after 5 increments
      if (count === 5) {
        if (incrementTimer.current) clearInterval(incrementTimer.current);
        interval = 100;
        incrementTimer.current = window.setInterval(() => {
          incrementAmount();
        }, interval);
      }
      incrementAmount();
    }, interval);
  };

  const stopIncrement = () => {
    if (incrementTimer.current) {
      clearInterval(incrementTimer.current);
      incrementTimer.current = null;
    }
  };

  const startDecrement = () => {
    hapticLight();
    decrementAmount();
    // Start with slower interval, then speed up
    let interval = 200;
    let count = 0;
    decrementTimer.current = window.setInterval(() => {
      count++;
      // Speed up after 5 decrements
      if (count === 5) {
        if (decrementTimer.current) clearInterval(decrementTimer.current);
        interval = 100;
        decrementTimer.current = window.setInterval(() => {
          decrementAmount();
        }, interval);
      }
      decrementAmount();
    }, interval);
  };

  const stopDecrement = () => {
    if (decrementTimer.current) {
      clearInterval(decrementTimer.current);
      decrementTimer.current = null;
    }
  };

  const handleModalClose = () => {
    stopIncrement();
    stopDecrement();
    setShowAddModal(false);
  };

  const handleCompleteEntry = async (id: number) => {
    await hapticSelection();
    await completeEntry(id);
    if (remaining - 1 === 0) {
      await hapticSuccess();
    }
  };

  const handleCompleteAll = async () => {
    await hapticSuccess();
    await completeAllEntries();
  };

  const handleDeleteEntry = async (id: number) => {
    await hapticWarning();
    await deleteEntry(id);
  };

  // Press and hold reset functionality
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

  const handleResetPressStart = () => {
    setIsPressing(true);
    setResetProgress(0);

    // Initial haptic feedback
    hapticWarning();

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

      setResetProgress(progressPercent);

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
        handleResetComplete();
      }
    }, 3100);
  };

  const handleResetPressEnd = () => {
    setIsPressing(false);
    setResetProgress(0);

    // Clear timers
    clearTimers();

    // Cancel animations
    cancelAnimation(progress);
    cancelAnimation(backgroundProgress);
    cancelAnimation(scaleValue);

    // Reset animation control
    if (animationControl.current) {
      animationControl.current.value = false;
    }

    // Reset values
    progress.value = 0;
    backgroundProgress.value = 0;
    scaleValue.value = 1;
  };

  const handleResetComplete = async () => {
    setIsResetting(true);

    // Clear timers and reset state
    clearTimers();
    setIsPressing(false);
    setResetProgress(0);

    if (animationControl.current) {
      animationControl.current.value = false;
    }

    // Reset animation values
    progress.value = 0;
    backgroundProgress.value = 0;
    scaleValue.value = 1;

    try {
      await resetAll();
      await loadData(); // Reload data to refresh UI
      await hapticSuccess();
    } catch (error) {
      console.error("Error resetting qada data:", error);
      await hapticWarning();
    } finally {
      setIsResetting(false);
    }
  };

  // Animated styles for reset button (matching athkar style)
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
      transformOrigin: I18nManager.isRTL ? "right" : "left",
    };
  });

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Background>
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            paddingBottom: totalMissed > 0 || totalCompleted > 0 ? 160 : 100,
          }}
          showsVerticalScrollIndicator={false}>
          <TopBar title="qada.title" />

          {/* Progress Dashboard */}
          <VStack className="px-4 py-6" space="xl">
            {/* Progress Card */}
            <Box className="bg-background-secondary dark:bg-background-tertiary rounded-xl p-4">
              <VStack space="lg" className="items-center">
                {/* Main Stats */}
                <VStack space="sm" className="items-center w-full">
                  <Text
                    className="text-4xl font-bold text-typography text-center w-full"
                    numberOfLines={1}
                    ellipsizeMode="clip">
                    {remaining}
                  </Text>
                  <Text className="text-lg text-typography-secondary text-center">
                    {t("qada.daysRemaining", { count: remaining })}
                  </Text>
                </VStack>

                {/* Progress Bar */}
                {totalMissed > 0 && (
                  <VStack space="sm" className="w-full">
                    <Progress value={completionPercentage} className="h-3 bg-background-tertiary">
                      <ProgressFilledTrack className="bg-accent-primary" />
                    </Progress>
                    <Text className="text-sm text-left text-typography-secondary">
                      {t("qada.completionPercentage", { percentage: completionPercentage })} •{" "}
                      {t("qada.progressContext", {
                        completed: totalCompleted,
                        total: totalOriginal,
                      })}
                    </Text>
                  </VStack>
                )}

                {/* Stats Row */}
                <HStack space="xl" className="w-full justify-around pt-4">
                  <VStack space="xs" className="items-center">
                    <Text className="text-2xl font-semibold text-typography text-left">
                      {totalMissed}
                    </Text>
                    <Text className="text-xs text-typography-secondary text-left">
                      {t("qada.total")}
                    </Text>
                  </VStack>
                  <VStack space="xs" className="items-center">
                    <Text className="text-2xl font-semibold text-success text-left">
                      {totalCompleted}
                    </Text>
                    <Text className="text-xs text-typography-secondary text-left">
                      {t("qada.completed")}
                    </Text>
                  </VStack>
                </HStack>

                {/* Motivational Message */}
                {remaining === 0 && totalMissed > 0 && (
                  <Text className="text-left text-success font-medium">
                    {t("qada.allComplete")}
                  </Text>
                )}
                {remaining > 0 && (
                  <Text className="text-left text-typography-secondary">
                    {t("qada.keepGoing", { count: remaining })}
                  </Text>
                )}
              </VStack>
            </Box>

            {/* Add Button */}
            <Button
              onPress={() => setShowAddModal(true)}
              className="bg-accent-primary"
              size="lg"
              isDisabled={isLoading}>
              <HStack space="sm" className="items-center">
                <Icon as={Plus} className="text-background" />
                <ButtonText className="text-background">{t("qada.addMissedDays")}</ButtonText>
              </HStack>
            </Button>

            {/* Pending Entries List */}
            {pendingEntries.length > 0 && (
              <VStack space="md">
                <Text className="text-lg font-semibold text-typography text-left">
                  {t("qada.pendingEntries")}
                </Text>

                <VStack space="sm">
                  {pendingEntries.map((entry) => (
                    <SwipeableEntry
                      key={entry.id}
                      entry={entry}
                      onComplete={handleCompleteEntry}
                      onCompleteAll={handleCompleteAll}
                      onDelete={handleDeleteEntry}
                    />
                  ))}
                </VStack>

                <Box className="bg-background-tertiary/50 rounded-lg p-3">
                  <Text className="text-xs text-typography-secondary text-center">
                    💡 {t("qada.swipeHintFull")}
                  </Text>
                </Box>
              </VStack>
            )}

            {/* Empty State */}
            {pendingEntries.length === 0 && remaining === 0 && totalMissed > 0 && (
              <Box className="py-8 items-center">
                <Box className="w-20 h-20 items-center justify-center">
                  <Icon as={Check} className="text-success" size="xl" />
                </Box>
                <Text className="text-lg font-semibold text-success mt-4">
                  {t("qada.allComplete")}
                </Text>
                <Text className="text-sm text-typography-secondary text-center mt-2">
                  {t("qada.allCompleteMessage")}
                </Text>
              </Box>
            )}

            {pendingEntries.length === 0 && totalMissed === 0 && (
              <Box className="py-8 items-center">
                <Box className="w-20 h-20 items-center justify-center">
                  <Icon as={CalendarDays} className="text-typography-secondary" size="xl" />
                </Box>
                <Text className="text-base text-typography-secondary text-center mt-4">
                  {t("qada.noEntriesYet")}
                </Text>
              </Box>
            )}
          </VStack>

          {/* Add Missed Days Modal: Quick add buttons + stepper control for intuitive UX */}
          <Modal isOpen={showAddModal} onClose={handleModalClose} size="md">
            <ModalBackdrop />
            <ModalContent className="bg-background-secondary mx-4 rounded-xl shadow-xl">
              <ModalCloseButton className="absolute top-4 right-4 z-10">
                <Icon as={X} className="text-typography-secondary" size="lg" />
              </ModalCloseButton>

              <ModalHeader className="px-6 pt-6 pb-4">
                <Text className="text-xl font-bold text-typography text-left">
                  {t("qada.addMissedDays")}
                </Text>
              </ModalHeader>

              <ModalBody className="px-6 py-2">
                <VStack space="xl">
                  {/* Quick Add: One-tap shortcuts for common values (1, 3, 7, 30 days) */}
                  <VStack space="sm">
                    <Text className="text-sm text-typography-secondary text-left">
                      {t("qada.quickAdd")}
                    </Text>
                    <HStack space="xs" className="w-full">
                      {[1, 3, 7, 30].map((days) => (
                        <Button
                          key={days}
                          onPress={() => handleQuickAdd(days)}
                          variant="outline"
                          isDisabled={isLoading}
                          className="flex-1 border-accent-primary px-2">
                          <ButtonText className="text-accent-primary font-semibold text-center">
                            +{days}
                          </ButtonText>
                        </Button>
                      ))}
                    </HStack>
                  </VStack>

                  {/* Divider with "or" text */}
                  <HStack space="sm" className="items-center">
                    <Box className="flex-1 h-px bg-outline" />
                    <Text className="text-xs text-typography-secondary">{t("common.or")}</Text>
                    <Box className="flex-1 h-px bg-outline" />
                  </HStack>

                  {/* Stepper Control: Fine-tune any amount with -/+ buttons */}
                  <VStack space="sm">
                    <Text className="text-sm text-typography-secondary text-left">
                      {t("qada.customAmount")}
                    </Text>
                    <HStack space="md" className="items-center justify-center">
                      <Pressable
                        onPressIn={startDecrement}
                        onPressOut={stopDecrement}
                        disabled={isLoading}
                        className="w-14 h-14 bg-background border-2 border-outline rounded-full items-center justify-center active:bg-background-tertiary">
                        <Text className="text-2xl text-typography font-bold">−</Text>
                      </Pressable>

                      <Box className="flex-1 items-center">
                        <Text className="text-5xl font-bold text-accent-primary">{amount}</Text>
                        <Text className="text-sm text-typography-secondary mt-1">
                          {t("qada.days", { count: amount })}
                        </Text>
                      </Box>

                      <Pressable
                        onPressIn={startIncrement}
                        onPressOut={stopIncrement}
                        disabled={isLoading}
                        className="w-14 h-14 bg-accent-primary rounded-full items-center justify-center active:opacity-80">
                        <Text className="text-2xl text-background font-bold">+</Text>
                      </Pressable>
                    </HStack>
                  </VStack>
                </VStack>
              </ModalBody>

              <ModalFooter className="px-6 py-6">
                <Button
                  onPress={handleAddMissed}
                  isDisabled={isLoading || amount <= 0}
                  className="w-full bg-accent-primary"
                  size="lg">
                  <ButtonText className="text-background text-base font-semibold">
                    {t("qada.addDays", { count: amount, defaultValue: `Add ${amount} Days` })}
                  </ButtonText>
                </Button>
              </ModalFooter>
            </ModalContent>
          </Modal>
        </ScrollView>

        {/* Reset Button - Fixed at bottom */}
        {(totalMissed > 0 || totalCompleted > 0) && (
          <Box className="absolute bottom-0 left-0 right-0 px-4 pb-6 pt-8 bg-gradient-to-t from-background via-background to-transparent">
            <VStack space="sm">
              <Text className="text-xs text-typography-secondary text-center">
                ⚠️ {t("qada.resetWarning")}
              </Text>
              {(() => {
                const longPressGesture = Gesture.Pan()
                  .onBegin(() => {
                    scheduleOnRN(handleResetPressStart);
                  })
                  .onFinalize(() => {
                    scheduleOnRN(handleResetPressEnd);
                  });

                return (
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
                        style={{ backgroundColor: "transparent" }}
                        disabled={isResetting}>
                        {isResetting ? (
                          <Spinner size="small" />
                        ) : (
                          <Icon size="md" className="text-white" as={RotateCcw} />
                        )}
                        <ButtonText className="text-white font-medium">
                          {isResetting
                            ? t("qada.reset")
                            : isPressing
                              ? `${Math.ceil(resetProgress)}% - ${t("qada.reset")}`
                              : t("qada.resetAll")}
                        </ButtonText>
                      </Button>

                      {/* Progress overlay */}
                      {isPressing && !isResetting && (
                        <Animated.View style={progressOverlayStyle} pointerEvents="none" />
                      )}
                    </Animated.View>
                  </GestureDetector>
                );
              })()}
            </VStack>
          </Box>
        )}
      </Background>
    </GestureHandlerRootView>
  );
};

export default QadaScreen;
