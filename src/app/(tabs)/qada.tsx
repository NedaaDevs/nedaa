import { useState, useRef, useEffect } from "react";
import { ScrollView, I18nManager, TextInput } from "react-native";
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
import SoundPreviewButton from "@/components/SoundPreviewButton";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { Progress, ProgressFilledTrack } from "@/components/ui/progress";
import { Pressable } from "@/components/ui/pressable";
import { Icon } from "@/components/ui/icon";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  Modal,
  ModalBackdrop,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
} from "@/components/ui/modal";
import {
  Select,
  SelectTrigger,
  SelectInput,
  SelectIcon,
  SelectPortal,
  SelectBackdrop,
  SelectContent,
  SelectDragIndicatorWrapper,
  SelectDragIndicator,
  SelectItem,
  SelectScrollView,
} from "@/components/ui/select";

// Stores
import { useQadaStore } from "@/stores/qada";
import { useNotificationStore } from "@/stores/notification";
import { useCustomSoundsStore } from "@/stores/customSounds";

// Constants
import { SOUND_ASSETS } from "@/constants/sounds";

// Utils
import { getAvailableSoundsWithCustom } from "@/utils/sound";

// Icons
import {
  Plus,
  Check,
  X,
  CalendarDays,
  Calendar,
  RotateCcw,
  Settings,
  Bell,
  BellOff,
  Eye,
  EyeOff,
  Info,
  Volume2,
  Vibrate,
  ChevronDown,
} from "lucide-react-native";

// Hooks
import { useHaptic } from "@/hooks/useHaptic";
import { useSoundPreview } from "@/hooks/useSoundPreview";

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
    reminderType,
    reminderDays,
    customDate,
    privacyMode,
    updateSettings,
  } = useQadaStore();

  const { settings } = useNotificationStore();
  const { customSounds } = useCustomSoundsStore();
  const { playPreview, stopPreview, isPlayingSound } = useSoundPreview();

  const [showAddModal, setShowAddModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [amount, setAmount] = useState(1);
  const [tempReminderType, setTempReminderType] = useState(reminderType);
  const [tempReminderDays, setTempReminderDays] = useState(reminderDays || 30);
  const [tempReminderDaysText, setTempReminderDaysText] = useState((reminderDays || 30).toString());
  const [tempCustomDate, setTempCustomDate] = useState(customDate);
  const [tempPrivacyMode, setTempPrivacyMode] = useState(privacyMode);
  const [tempQadaSound, setTempQadaSound] = useState(settings.defaults.qada.sound);
  const [tempQadaVibration, setTempQadaVibration] = useState(settings.defaults.qada.vibration);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

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

  // Sync temp variables with store values when modal opens
  useEffect(() => {
    if (showSettingsModal) {
      setTempReminderType(reminderType);
      setTempReminderDays(reminderDays || 30);
      setTempReminderDaysText((reminderDays || 30).toString());
      setTempCustomDate(customDate);
      setTempPrivacyMode(privacyMode);
      setTempQadaSound(settings.defaults.qada.sound);
      setTempQadaVibration(settings.defaults.qada.vibration);
    }
  }, [
    showSettingsModal,
    reminderType,
    reminderDays,
    customDate,
    privacyMode,
    settings.defaults.qada.sound,
    settings.defaults.qada.vibration,
  ]);

  // Sound options based on notification type (including custom sounds)
  const baseSoundOptions = getAvailableSoundsWithCustom("qada", customSounds);

  // Add default (system) sound option at the beginning
  const soundOptions = [
    {
      value: "default",
      label: "Default (System)",
      isPreviewable: false,
      isCustom: false,
    },
    ...baseSoundOptions,
  ];

  const getTranslatedSoundLabel = () => {
    // Check if this is a custom sound
    const customSound = customSounds.find((s) => s.id === tempQadaSound);
    if (customSound) return customSound.name;

    // Handle default/system sound
    if (tempQadaSound === "default") return "Default (System)";

    // Otherwise, it's a bundled sound
    const soundAsset = SOUND_ASSETS[tempQadaSound as keyof typeof SOUND_ASSETS];
    if (!soundAsset) return t("notification.sound.unknown");
    return t(soundAsset.label);
  };

  const handleSoundPreview = async () => {
    if (isPlayingSound("qada", tempQadaSound)) {
      await stopPreview();
    } else {
      await playPreview("qada", tempQadaSound);
    }
  };

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
          <Box className="relative">
            <TopBar title="qada.title" />
            {/* Settings Icon Overlay */}
            <Pressable
              onPress={() => {
                hapticLight();
                setShowSettingsModal(true);
                // Reset temp values
                setTempReminderType(reminderType);
                setTempReminderDays(reminderDays || 30);
                setTempReminderDaysText((reminderDays || 30).toString());
                setTempCustomDate(customDate);
                setTempPrivacyMode(privacyMode);
                setTempQadaSound(settings.defaults.qada.sound);
                setTempQadaVibration(settings.defaults.qada.vibration);
              }}
              className="absolute right-6 top-2 justify-center p-2 rounded-lg"
              style={{ zIndex: 50, elevation: 4 }}>
              <Icon as={Settings} size="lg" className="text-typography-contrast" />
            </Pressable>
          </Box>

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
              onPress={() => {
                setShowAddModal(true);
              }}
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

          {/* Settings Modal */}
          <Modal isOpen={showSettingsModal} onClose={() => setShowSettingsModal(false)} size="lg">
            <ModalBackdrop />
            <ModalContent className="bg-background-secondary mx-4 rounded-2xl shadow-xl">
              <ModalCloseButton className="absolute top-4 right-4 z-10">
                <Icon as={X} className="text-typography-secondary" size="lg" />
              </ModalCloseButton>

              <ModalHeader className="px-6 pt-6 pb-4">
                <VStack className="items-center w-full" space="sm">
                  <Box className="w-16 h-16 rounded-full bg-background-info items-center justify-center">
                    <Icon as={Bell} className="text-info" size="xl" />
                  </Box>
                  <Text className="text-xl font-bold text-typography text-center">
                    {t("qada.notificationSettings")}
                  </Text>
                </VStack>
              </ModalHeader>

              <ModalBody className="px-6 pt-2 pb-4 max-h-[70vh]">
                <ScrollView showsVerticalScrollIndicator={false}>
                  <VStack space="lg" className="pb-6">
                    {/* Reminder Type */}
                    <VStack space="sm">
                      <Text className="text-sm font-semibold text-typography mb-1">
                        {t("qada.reminderType")}
                      </Text>
                      <VStack space="xs">
                        {[
                          { value: "none", label: t("qada.reminderNone"), icon: BellOff },
                          {
                            value: "ramadan",
                            label: t("qada.reminderRamadan"),
                            icon: CalendarDays,
                          },
                          { value: "custom", label: t("qada.reminderCustom"), icon: Calendar },
                        ].map((option) => (
                          <Pressable
                            key={option.value}
                            onPress={() => setTempReminderType(option.value as any)}
                            className={`p-4 rounded-xl border ${
                              tempReminderType === option.value
                                ? "border-primary bg-background-info/10"
                                : "border-outline bg-background"
                            }`}>
                            <HStack className="items-center justify-between">
                              <HStack className="items-center flex-1" space="md">
                                <Icon
                                  as={option.icon}
                                  size="md"
                                  className={
                                    tempReminderType === option.value
                                      ? "text-primary"
                                      : "text-typography-secondary"
                                  }
                                />
                                <Text
                                  className={`font-medium ${
                                    tempReminderType === option.value
                                      ? "text-primary"
                                      : "text-typography"
                                  }`}>
                                  {option.label}
                                </Text>
                              </HStack>
                              <Box
                                className={`w-5 h-5 rounded-full border-2 ${
                                  tempReminderType === option.value
                                    ? "border-primary bg-primary"
                                    : "border-outline"
                                }`}>
                                {tempReminderType === option.value && (
                                  <Box className="w-2.5 h-2.5 rounded-full bg-background m-auto" />
                                )}
                              </Box>
                            </HStack>
                          </Pressable>
                        ))}
                      </VStack>
                    </VStack>

                    {/* Ramadan Days Configuration */}
                    {tempReminderType === "ramadan" && (
                      <VStack
                        space="sm"
                        className="p-4 bg-background rounded-xl border border-outline">
                        <HStack className="items-center justify-between">
                          <Text className="text-sm font-medium text-typography">
                            {t("qada.daysBeforeRamadan")}
                          </Text>
                          <Text className="text-xs text-typography-secondary">1-365 days</Text>
                        </HStack>
                        <TextInput
                          value={tempReminderDaysText}
                          onChangeText={(text) => {
                            // Allow empty string or only digits
                            if (text === "" || /^\d+$/.test(text)) {
                              setTempReminderDaysText(text);
                              // Update the actual value only if it's a valid number
                              const num = parseInt(text);
                              if (!isNaN(num) && num >= 1 && num <= 365) {
                                setTempReminderDays(num);
                              }
                            }
                          }}
                          onBlur={() => {
                            // If empty or invalid on blur, reset to default
                            if (tempReminderDaysText === "" || parseInt(tempReminderDaysText) < 1) {
                              setTempReminderDaysText("30");
                              setTempReminderDays(30);
                            }
                          }}
                          keyboardType="numeric"
                          className="text-center p-3 bg-background-secondary rounded-lg text-lg font-semibold text-typography border border-outline"
                          maxLength={3}
                          placeholder="30"
                        />
                      </VStack>
                    )}

                    {/* Custom Date Configuration */}
                    {tempReminderType === "custom" && (
                      <VStack
                        space="sm"
                        className="p-4 bg-background rounded-xl border border-outline">
                        <Text className="text-sm font-medium text-typography mb-1">
                          {t("qada.customDate")}
                        </Text>
                        <Pressable
                          onPress={() => setShowDatePicker(true)}
                          className="bg-background-secondary border border-outline rounded-lg px-4 py-3 min-h-[48px] justify-center">
                          <HStack className="items-center justify-between">
                            <Text
                              className={`font-medium text-base ${tempCustomDate ? "text-typography" : "text-typography-secondary"}`}>
                              {tempCustomDate
                                ? new Date(tempCustomDate).toLocaleDateString("en-US", {
                                    year: "numeric",
                                    month: "long",
                                    day: "numeric",
                                  })
                                : t("qada.selectDate")}
                            </Text>
                            <Icon
                              as={CalendarDays}
                              size="sm"
                              className="text-typography-secondary"
                            />
                          </HStack>
                        </Pressable>
                        {tempCustomDate && new Date(tempCustomDate) < new Date() && (
                          <HStack className="items-center mt-1" space="xs">
                            <Icon as={Info} size="xs" className="text-warning" />
                            <Text className="text-xs text-warning">{t("qada.dateInPast")}</Text>
                          </HStack>
                        )}
                      </VStack>
                    )}

                    {/* Privacy Mode */}
                    {tempReminderType !== "none" && (
                      <VStack space="sm">
                        <Pressable
                          onPress={() => setTempPrivacyMode(!tempPrivacyMode)}
                          className="p-4 rounded-xl border border-outline bg-background">
                          <HStack className="items-center justify-between">
                            <HStack className="items-center flex-1" space="md">
                              <Icon
                                as={tempPrivacyMode ? EyeOff : Eye}
                                size="md"
                                className="text-typography-secondary"
                              />
                              <VStack className="flex-1">
                                <Text className="font-medium text-typography">
                                  {t("qada.privacyMode")}
                                </Text>
                                <Text className="text-xs text-typography-secondary mt-0.5">
                                  {tempPrivacyMode
                                    ? t("qada.privacyEnabled")
                                    : t("qada.privacyDisabled")}
                                </Text>
                              </VStack>
                            </HStack>
                            <Switch value={tempPrivacyMode} onValueChange={setTempPrivacyMode} />
                          </HStack>
                        </Pressable>

                        {/* Privacy Example */}
                        <Box className="p-3 bg-background-secondary rounded-xl border border-outline">
                          <VStack space="xs">
                            <Text className="text-xs font-medium text-typography-secondary">
                              {tempPrivacyMode
                                ? t("qada.privacyEnabled")
                                : t("qada.privacyDisabled")}{" "}
                              - {t("qada.notificationPreview")}
                            </Text>
                            <Text className="text-sm text-typography">
                              {tempPrivacyMode
                                ? t("notification.qada.bodyPrivacy")
                                : t("notification.qada.bodyWithCount", { count: remaining })}
                            </Text>
                          </VStack>
                        </Box>
                      </VStack>
                    )}

                    {/* Sound & Vibration */}
                    {tempReminderType !== "none" && (
                      <VStack space="sm">
                        <Text className="text-sm font-semibold text-typography">
                          {t("notification.soundAndVibration")}
                        </Text>

                        {/* Sound Selection */}
                        <VStack
                          space="xs"
                          className="p-4 bg-background rounded-xl border border-outline">
                          <HStack className="items-center justify-between mb-2">
                            <HStack className="items-center flex-1" space="sm">
                              <Icon as={Volume2} size="sm" className="text-typography-secondary" />
                              <Text className="text-sm font-medium text-typography">
                                {t("notification.sound")}
                              </Text>
                            </HStack>
                            <SoundPreviewButton
                              isPlaying={isPlayingSound("qada", tempQadaSound)}
                              onPress={handleSoundPreview}
                              disabled={
                                !tempQadaSound ||
                                tempQadaSound === "silent" ||
                                tempQadaSound === "default"
                              }
                              size="md"
                              color="text-primary"
                            />
                          </HStack>
                          <Select
                            selectedValue={tempQadaSound}
                            initialLabel={tempQadaSound ? getTranslatedSoundLabel() : ""}
                            onValueChange={(value) => setTempQadaSound(value as any)}>
                            <SelectTrigger
                              variant="outline"
                              size="lg"
                              className="bg-background-secondary border border-outline rounded-lg h-12">
                              <SelectInput
                                placeholder={t("notification.sound.selectPlaceholder")}
                                className="text-left !text-typography font-medium"
                              />
                              <SelectIcon className="mr-3">
                                <Icon as={ChevronDown} className="text-typography-secondary" />
                              </SelectIcon>
                            </SelectTrigger>
                            <SelectPortal>
                              <SelectBackdrop />
                              <SelectContent className="bg-background-secondary rounded-xl shadow-xl mx-4">
                                <SelectDragIndicatorWrapper>
                                  <SelectDragIndicator />
                                </SelectDragIndicatorWrapper>
                                <SelectScrollView className="max-h-80">
                                  {soundOptions.map((option) => (
                                    <SelectItem
                                      key={option.value}
                                      label={t(option.label, option.label)}
                                      value={option.value}
                                    />
                                  ))}
                                </SelectScrollView>
                              </SelectContent>
                            </SelectPortal>
                          </Select>
                        </VStack>

                        {/* Vibration Toggle */}
                        <Pressable
                          onPress={() => setTempQadaVibration(!tempQadaVibration)}
                          className="p-4 rounded-xl border border-outline bg-background">
                          <HStack className="items-center justify-between">
                            <HStack className="items-center flex-1" space="md">
                              <Icon as={Vibrate} size="md" className="text-typography-secondary" />
                              <Text className="font-medium text-typography">
                                {t("notification.vibration")}
                              </Text>
                            </HStack>
                            <Switch
                              value={tempQadaVibration}
                              onValueChange={setTempQadaVibration}
                            />
                          </HStack>
                        </Pressable>
                      </VStack>
                    )}
                  </VStack>
                </ScrollView>
              </ModalBody>

              <ModalFooter className="px-6 py-6">
                <VStack space="sm" className="w-full">
                  <Button
                    size="lg"
                    className="w-full bg-accent-primary"
                    disabled={isSavingSettings}
                    onPress={async () => {
                      try {
                        setIsSavingSettings(true);
                        await hapticSuccess();

                        // IMPORTANT: Update notification settings FIRST before qada settings
                        // This ensures the enabled flag is set before scheduling is triggered
                        const { updateDefault } = useNotificationStore.getState();

                        // Enable qada notifications if reminder type is not 'none', disable otherwise
                        await updateDefault("qada", "enabled", tempReminderType !== "none");
                        await updateDefault("qada", "sound", tempQadaSound);
                        await updateDefault("qada", "vibration", tempQadaVibration);

                        // Now update qada-specific settings (this triggers scheduling with correct enabled state)
                        const qadaSuccess = await updateSettings({
                          reminder_type: tempReminderType,
                          reminder_days: tempReminderType === "ramadan" ? tempReminderDays : null,
                          custom_date: tempReminderType === "custom" ? tempCustomDate : null,
                          privacy_mode: tempPrivacyMode ? 1 : 0,
                        });

                        if (qadaSuccess) {
                          setShowSettingsModal(false);
                        }
                      } catch (error) {
                        console.error("Error saving settings:", error);
                      } finally {
                        setIsSavingSettings(false);
                      }
                    }}>
                    {isSavingSettings ? (
                      <Spinner size="small" color="white" />
                    ) : (
                      <ButtonText className="text-background font-medium">
                        {t("common.save")}
                      </ButtonText>
                    )}
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full"
                    disabled={isSavingSettings}
                    onPress={() => setShowSettingsModal(false)}>
                    <ButtonText className="text-typography">{t("common.cancel")}</ButtonText>
                  </Button>
                </VStack>
              </ModalFooter>
            </ModalContent>
          </Modal>

          {/* Date Picker Modal */}
          {showDatePicker && (
            <DateTimePicker
              value={tempCustomDate ? new Date(tempCustomDate) : new Date()}
              mode="date"
              minimumDate={new Date()}
              display="default"
              onChange={(event, selectedDate) => {
                setShowDatePicker(false);
                if (event.type === "set" && selectedDate) {
                  setTempCustomDate(selectedDate.toISOString().split("T")[0]);
                }
              }}
            />
          )}
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
