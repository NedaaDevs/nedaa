import { useState, useEffect, useRef, useMemo } from "react";
import { ScrollView, TextInput } from "react-native";
import { useTranslation } from "react-i18next";
import { router } from "expo-router";
import DateTimePicker from "@react-native-community/datetimepicker";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  cancelAnimation,
  runOnJS,
} from "react-native-reanimated";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import { useTheme } from "tamagui";

// Components
import { Background } from "@/components/ui/background";
import TopBar from "@/components/TopBar";
import SoundPreviewButton from "@/components/SoundPreviewButton";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Box } from "@/components/ui/box";
import { Button } from "@/components/ui/button";
import { Pressable } from "@/components/ui/pressable";
import { Icon } from "@/components/ui/icon";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Select } from "@/components/ui/select";

// Stores
import { useQadaStore } from "@/stores/qada";
import { useNotificationStore } from "@/stores/notification";
import { useCustomSoundsStore } from "@/stores/customSounds";
import appStore from "@/stores/app";

// Utils
import { getAvailableSoundsWithCustom } from "@/utils/sound";
import { formatNumberToLocale, normalizeNumber } from "@/utils/number";

// Hooks
import { useHaptic } from "@/hooks/useHaptic";
import { useSoundPreview } from "@/hooks/useSoundPreview";

// Icons
import {
  CalendarDays,
  Calendar,
  BellOff,
  Eye,
  EyeOff,
  Info,
  Volume2,
  Vibrate,
  ChevronDown,
  AlertTriangle,
  RotateCcw,
} from "lucide-react-native";

const QadaSettings = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const hapticSuccess = useHaptic("success");
  const hapticWarning = useHaptic("warning");
  const hapticLight = useHaptic("light");
  const { playPreview, stopPreview, isPlayingSound } = useSoundPreview();

  // Stores
  const {
    reminderType,
    reminderDays,
    customDate,
    privacyMode,
    updateSettings,
    getRemaining,
    resetAll,
    loadData,
    totalMissed,
    totalCompleted,
  } = useQadaStore();
  const remaining = getRemaining();
  const { settings } = useNotificationStore();
  const { customSounds } = useCustomSoundsStore();

  // Local state
  const [tempReminderType, setTempReminderType] = useState(reminderType);
  const [tempReminderDays, setTempReminderDays] = useState(reminderDays || 30);
  const [tempReminderDaysText, setTempReminderDaysText] = useState((reminderDays || 30).toString());
  const [tempCustomDate, setTempCustomDate] = useState(customDate);
  const [tempPrivacyMode, setTempPrivacyMode] = useState(privacyMode);
  const [tempQadaSound, setTempQadaSound] = useState(settings.defaults.qada.sound);
  const [tempQadaVibration, setTempQadaVibration] = useState(settings.defaults.qada.vibration);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [daysError, setDaysError] = useState<string | null>(null);

  // Danger Zone state
  const [dangerZoneExpanded, setDangerZoneExpanded] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetProgress, setResetProgress] = useState(0);
  const [isPressing, setIsPressing] = useState(false);
  const progress = useSharedValue(0);
  const backgroundProgress = useSharedValue(0);
  const scaleValue = useSharedValue(1);
  const animationControl = useRef<{ value: boolean } | null>(null);
  const hapticTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync with store values on mount
  useEffect(() => {
    setTempReminderType(reminderType);
    setTempReminderDays(reminderDays || 30);
    setTempReminderDaysText((reminderDays || 30).toString());
    setTempCustomDate(customDate);
    setTempPrivacyMode(privacyMode);
    setTempQadaSound(settings.defaults.qada.sound);
    setTempQadaVibration(settings.defaults.qada.vibration);
  }, [reminderType, reminderDays, customDate, privacyMode, settings.defaults.qada]);

  const baseSoundOptions = getAvailableSoundsWithCustom("qada", customSounds || []);

  // Add default (system) sound option at the beginning
  const soundItems = useMemo(
    () =>
      [
        {
          value: "default",
          label: "notification.sound.default",
          isPreviewable: false,
          isCustom: false,
        },
        ...baseSoundOptions,
      ].map((opt) => ({ label: t(opt.label, opt.label), value: opt.value })),
    [baseSoundOptions, t]
  );

  const handleSoundPreview = async () => {
    if (isPlayingSound("qada", tempQadaSound)) {
      stopPreview();
    } else {
      await playPreview("qada", tempQadaSound);
    }
  };

  const handleSave = async () => {
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
        router.back();
      }
    } catch (error) {
      console.error("Error saving settings:", error);
    } finally {
      setIsSavingSettings(false);
    }
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
      await loadData();
      await hapticSuccess();
    } catch (error) {
      console.error("Error resetting qada data:", error);
      await hapticWarning();
    } finally {
      setIsResetting(false);
    }
  };

  // Animated styles for reset button
  const errorColor = theme.error.val;
  const buttonAnimatedStyle = useAnimatedStyle(() => {
    return {
      backgroundColor: errorColor,
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
    };
  });

  return (
    <Background>
      <TopBar title="qada.notificationSettings" backOnClick={true} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: totalMissed > 0 || totalCompleted > 0 ? 200 : 120,
        }}>
        <VStack gap="$4" paddingHorizontal="$4" paddingTop="$6" paddingBottom="$4">
          {/* Reminder Type */}
          <VStack gap="$2">
            <Text fontWeight="600" color="$typography" marginBottom="$2">
              {t("qada.reminderType")}
            </Text>
            <VStack gap="$1">
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
                  padding="$4"
                  borderRadius="$6"
                  borderWidth={1}
                  borderColor={tempReminderType === option.value ? "$primary" : "$outline"}
                  backgroundColor={
                    tempReminderType === option.value ? "$backgroundInfo" : "$background"
                  }>
                  <HStack alignItems="center" justifyContent="space-between">
                    <HStack alignItems="center" flex={1} gap="$3">
                      <Icon
                        as={option.icon}
                        size="md"
                        color={
                          tempReminderType === option.value ? "$primary" : "$typographySecondary"
                        }
                      />
                      <Text
                        fontWeight="500"
                        color={tempReminderType === option.value ? "$primary" : "$typography"}>
                        {option.label}
                      </Text>
                    </HStack>
                    <Box
                      width={20}
                      height={20}
                      borderRadius={999}
                      borderWidth={2}
                      borderColor={tempReminderType === option.value ? "$primary" : "$outline"}
                      backgroundColor={
                        tempReminderType === option.value ? "$primary" : "transparent"
                      }>
                      {tempReminderType === option.value && (
                        <Box
                          width={10}
                          height={10}
                          borderRadius={999}
                          backgroundColor="$background"
                          margin="auto"
                        />
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
              gap="$2"
              padding="$4"
              backgroundColor="$background"
              borderRadius="$6"
              borderWidth={1}
              borderColor="$outline">
              <HStack alignItems="center" justifyContent="space-between">
                <Text size="sm" fontWeight="500" color="$typography">
                  {t("qada.daysBeforeRamadan")}
                </Text>
                <Text size="xs" color="$typographySecondary">
                  {formatNumberToLocale("1")}-
                  {formatNumberToLocale(t("qada.days_other", { count: 365 }))}
                </Text>
              </HStack>
              <TextInput
                value={formatNumberToLocale(tempReminderDaysText)}
                onChangeText={(text) => {
                  // Normalize the input first (convert Arabic digits to ASCII)
                  const normalizedText = normalizeNumber(text);

                  // Allow empty string or only digits
                  if (normalizedText === "" || /^\d+$/.test(normalizedText)) {
                    setTempReminderDaysText(normalizedText);

                    // Validate the number
                    if (normalizedText === "") {
                      setDaysError(null);
                    } else {
                      const num = parseInt(normalizedText);
                      if (isNaN(num) || num < 1 || num > 365) {
                        setDaysError(
                          t("qada.daysError", "Please enter a number between 1 and 365")
                        );
                      } else {
                        setDaysError(null);
                        setTempReminderDays(num);
                      }
                    }
                  }
                }}
                onBlur={() => {
                  // If empty or invalid on blur, reset to default
                  if (tempReminderDaysText === "") {
                    setTempReminderDaysText("30");
                    setTempReminderDays(30);
                    setDaysError(null);
                  } else {
                    const num = parseInt(tempReminderDaysText);
                    if (num < 1 || num > 365) {
                      setTempReminderDaysText("30");
                      setTempReminderDays(30);
                      setDaysError(null);
                    }
                  }
                }}
                keyboardType="numeric"
                style={{
                  textAlign: "center",
                  padding: 12,
                  borderRadius: 8,
                  fontSize: 18,
                  fontWeight: "600",
                  borderWidth: 1,
                  borderColor: daysError ? theme.error.val : theme.outline.val,
                  color: theme.typography.val,
                }}
                maxLength={3}
                placeholder="30"
              />
              {daysError && (
                <HStack alignItems="center" marginTop="$2" gap="$1">
                  <Icon as={Info} size="xs" color="$error" />
                  <Text size="xs" color="$error">
                    {daysError}
                  </Text>
                </HStack>
              )}
            </VStack>
          )}

          {/* Custom Date Configuration */}
          {tempReminderType === "custom" && (
            <VStack
              gap="$2"
              padding="$4"
              backgroundColor="$background"
              borderRadius="$6"
              borderWidth={1}
              borderColor="$outline">
              <Text size="sm" fontWeight="500" color="$typography" marginBottom="$1">
                {t("qada.customDate")}
              </Text>
              <Pressable
                onPress={() => setShowDatePicker(true)}
                backgroundColor="$backgroundSecondary"
                borderWidth={1}
                borderColor="$outline"
                borderRadius="$4"
                paddingHorizontal="$4"
                paddingVertical="$3"
                minHeight={48}
                justifyContent="center">
                <HStack alignItems="center" justifyContent="space-between">
                  <Text
                    fontWeight="500"
                    color={tempCustomDate ? "$typography" : "$typographySecondary"}>
                    {tempCustomDate
                      ? formatNumberToLocale(
                          new Date(tempCustomDate).toLocaleDateString(appStore.getState().locale, {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })
                        )
                      : t("qada.selectDate")}
                  </Text>
                  <Icon as={CalendarDays} size="sm" color="$typographySecondary" />
                </HStack>
              </Pressable>
              {tempCustomDate && new Date(tempCustomDate) < new Date() && (
                <HStack alignItems="center" marginTop="$1" gap="$1">
                  <Icon as={Info} size="xs" color="$warning" />
                  <Text size="xs" color="$warning">
                    {t("qada.dateInPast")}
                  </Text>
                </HStack>
              )}

              {/* Date Picker Modal */}
              {showDatePicker && (
                <DateTimePicker
                  value={tempCustomDate ? new Date(tempCustomDate) : new Date()}
                  mode="date"
                  display="spinner"
                  locale={appStore.getState().locale}
                  onChange={(event, selectedDate) => {
                    setShowDatePicker(false);
                    if (selectedDate) {
                      setTempCustomDate(selectedDate.toISOString());
                    }
                  }}
                />
              )}
            </VStack>
          )}

          {/* Privacy Mode */}
          {tempReminderType !== "none" && (
            <VStack gap="$2">
              <Pressable
                onPress={() => setTempPrivacyMode(!tempPrivacyMode)}
                padding="$4"
                borderRadius="$6"
                borderWidth={1}
                borderColor="$outline"
                backgroundColor="$background">
                <HStack alignItems="center" justifyContent="space-between">
                  <HStack alignItems="center" flex={1} gap="$3">
                    <Icon
                      as={tempPrivacyMode ? EyeOff : Eye}
                      size="md"
                      color="$typographySecondary"
                    />
                    <VStack flex={1}>
                      <Text fontWeight="500" color="$typography">
                        {t("qada.privacyMode")}
                      </Text>
                      <Text size="xs" color="$typographySecondary" marginTop="$0.5">
                        {tempPrivacyMode ? t("qada.privacyEnabled") : t("qada.privacyDisabled")}
                      </Text>
                    </VStack>
                  </HStack>
                  <Switch value={tempPrivacyMode} onValueChange={setTempPrivacyMode} />
                </HStack>
              </Pressable>

              {/* Privacy Example */}
              <Box
                padding="$3"
                backgroundColor="$backgroundSecondary"
                borderRadius="$6"
                borderWidth={1}
                borderColor="$outline">
                <VStack gap="$1">
                  <Text size="xs" fontWeight="500" color="$typographySecondary">
                    {tempPrivacyMode ? t("qada.privacyEnabled") : t("qada.privacyDisabled")} -{" "}
                    {t("qada.notificationPreview")}
                  </Text>
                  <Text size="sm" color="$typography">
                    {tempPrivacyMode
                      ? t("notification.qada.bodyPrivacy")
                      : formatNumberToLocale(
                          t("notification.qada.bodyWithCount", { count: remaining })
                        )}
                  </Text>
                </VStack>
              </Box>
            </VStack>
          )}

          {/* Sound & Vibration */}
          {tempReminderType !== "none" && (
            <VStack gap="$2">
              <Text fontWeight="600" color="$typography" marginBottom="$2">
                {t("notification.soundAndVibration")}
              </Text>

              {/* Sound Selection */}
              <VStack
                gap="$1"
                padding="$4"
                backgroundColor="$background"
                borderRadius="$6"
                borderWidth={1}
                borderColor="$outline">
                <HStack alignItems="center" justifyContent="space-between" marginBottom="$2">
                  <HStack alignItems="center" flex={1} gap="$2">
                    <Icon as={Volume2} size="sm" color="$typographySecondary" />
                    <Text size="sm" fontWeight="500" color="$typography">
                      {t("notification.sound")}
                    </Text>
                  </HStack>
                  <SoundPreviewButton
                    isPlaying={isPlayingSound("qada", tempQadaSound)}
                    onPress={handleSoundPreview}
                    disabled={
                      !tempQadaSound || tempQadaSound === "silent" || tempQadaSound === "default"
                    }
                    size="md"
                    color="$primary"
                  />
                </HStack>
                <Select
                  selectedValue={tempQadaSound}
                  placeholder={t("notification.sound.selectPlaceholder")}
                  onValueChange={(value) => setTempQadaSound(value as any)}
                  items={soundItems}
                />
              </VStack>

              {/* Vibration Toggle */}
              <Pressable
                onPress={() => setTempQadaVibration(!tempQadaVibration)}
                padding="$4"
                borderRadius="$6"
                borderWidth={1}
                borderColor="$outline"
                backgroundColor="$background">
                <HStack alignItems="center" justifyContent="space-between">
                  <HStack alignItems="center" flex={1} gap="$3">
                    <Icon as={Vibrate} size="md" color="$typographySecondary" />
                    <Text fontWeight="500" color="$typography">
                      {t("notification.vibration")}
                    </Text>
                  </HStack>
                  <Switch value={tempQadaVibration} onValueChange={setTempQadaVibration} />
                </HStack>
              </Pressable>
            </VStack>
          )}

          {/* Save Button */}
          <Button
            size="lg"
            width="100%"
            backgroundColor="$accentPrimary"
            marginTop="$4"
            disabled={isSavingSettings || daysError !== null}
            onPress={handleSave}>
            {isSavingSettings ? (
              <Spinner size="small" color="$typographyContrast" />
            ) : (
              <Button.Text color="$typographyContrast" fontWeight="500">
                {t("common.save")}
              </Button.Text>
            )}
          </Button>
        </VStack>
      </ScrollView>

      {/* Danger Zone - Fixed at Bottom */}
      {(totalMissed > 0 || totalCompleted > 0) && (
        <Box
          position="absolute"
          bottom={0}
          left={0}
          right={0}
          backgroundColor="$background"
          borderTopWidth={1}
          borderColor="$outline"
          paddingBottom="$5">
          <VStack gap="$3" paddingHorizontal="$4" paddingVertical="$4">
            <Pressable
              onPress={() => setDangerZoneExpanded(!dangerZoneExpanded)}
              padding="$4"
              borderRadius="$6"
              borderWidth={1}
              borderColor="$error"
              backgroundColor="$background">
              <HStack alignItems="center" justifyContent="space-between">
                <HStack alignItems="center" flex={1} gap="$3">
                  <Icon as={AlertTriangle} size="md" color="$error" />
                  <Text fontWeight="600" color="$error">
                    {t("qada.dangerZone.title")}
                  </Text>
                </HStack>
                <Icon as={ChevronDown} size="md" color="$error" />
              </HStack>
            </Pressable>

            {dangerZoneExpanded && (
              <VStack gap="$3" paddingHorizontal="$2">
                <VStack gap="$1">
                  <Text size="sm" fontWeight="500" color="$typography">
                    {t("qada.dangerZone.resetTitle")}
                  </Text>
                  <Text size="xs" color="$typographySecondary">
                    {t("qada.dangerZone.resetDescription")}
                  </Text>
                  {(totalMissed > 0 || totalCompleted > 0) && (
                    <VStack gap="$1" marginTop="$2">
                      <Text size="xs" color="$typographySecondary">
                        {t("qada.dangerZone.willDelete")}
                      </Text>
                      {totalMissed > 0 && (
                        <Text size="xs" color="$error">
                          •{" "}
                          {formatNumberToLocale(
                            t("qada.dangerZone.missedCount", { count: totalMissed })
                          )}
                        </Text>
                      )}
                      {totalCompleted > 0 && (
                        <Text size="xs" color="$error">
                          •{" "}
                          {formatNumberToLocale(
                            t("qada.dangerZone.completedCount", { count: totalCompleted })
                          )}
                        </Text>
                      )}
                    </VStack>
                  )}
                </VStack>

                <Text size="xs" color="$typographySecondary" textAlign="center">
                  {t("qada.resetWarning")}
                </Text>

                {(() => {
                  const longPressGesture = Gesture.Pan()
                    .onBegin(() => {
                      runOnJS(handleResetPressStart)();
                    })
                    .onFinalize(() => {
                      runOnJS(handleResetPressEnd)();
                    });

                  return (
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
                          width="100%"
                          borderWidth={0}
                          style={{ backgroundColor: "transparent" }}
                          disabled={isResetting}>
                          {isResetting ? (
                            <Spinner size="small" />
                          ) : (
                            <Icon size="md" color="$typographyContrast" as={RotateCcw} />
                          )}
                          <Button.Text color="$typographyContrast" fontWeight="500">
                            {isResetting
                              ? t("qada.reset")
                              : isPressing
                                ? `${formatNumberToLocale(Math.ceil(resetProgress).toString())}% - ${t("qada.reset")}`
                                : t("qada.resetAll")}
                          </Button.Text>
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
            )}
          </VStack>
        </Box>
      )}
    </Background>
  );
};

export default QadaSettings;
