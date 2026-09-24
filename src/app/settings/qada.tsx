import { useState, useMemo } from "react";
import { ScrollView, TextInput } from "react-native";
import { useTranslation } from "react-i18next";
import { router } from "expo-router";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useTheme } from "@/components/ui/theme-color";

// Components
import { Background } from "@/components/ui/background";
import { ScreenHeader } from "@/components/ui/screen-header";
import SoundPreviewButton from "@/components/SoundPreviewButton";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Box } from "@/components/ui/box";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pressable } from "@/components/ui/pressable";
import { Icon } from "@/components/ui/icon";
import { Spinner } from "@/components/ui/spinner";
import { HoldToConfirm } from "@/components/ui/hold-to-confirm";
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
  TriangleAlert,
  RotateCcw,
} from "lucide-react-native";

const QadaSettings = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const hapticSuccess = useHaptic("success");
  const hapticWarning = useHaptic("warning");
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

  const handleResetComplete = async () => {
    setIsResetting(true);
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

  return (
    <Background>
      <ScreenHeader variant="bar" title={t("qada.notificationSettings")} back />

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
              ].map((option) => {
                const isSelected = tempReminderType === option.value;
                return (
                  <Card.Pressable
                    key={option.value}
                    onPress={() => setTempReminderType(option.value as any)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={option.label}
                    borderWidth={1}
                    borderColor={isSelected ? "$primary" : "$outline"}>
                    <HStack alignItems="center" justifyContent="space-between">
                      <HStack alignItems="center" flex={1} gap="$3">
                        <Icon
                          as={option.icon}
                          size="md"
                          color={isSelected ? "$primary" : "$typographySecondary"}
                        />
                        <Text
                          fontWeight="500"
                          color={isSelected ? "$typography" : "$typographySecondary"}>
                          {option.label}
                        </Text>
                      </HStack>
                      <Box
                        width={20}
                        height={20}
                        borderRadius={999}
                        borderWidth={2}
                        borderColor={isSelected ? "$primary" : "$outline"}
                        backgroundColor={isSelected ? "$primary" : "transparent"}>
                        {isSelected && (
                          <Box
                            width={10}
                            height={10}
                            borderRadius={999}
                            // eslint-disable-next-line no-restricted-syntax -- radio dot fill, not a card surface
                            backgroundColor="$backgroundSecondary"
                            margin="auto"
                          />
                        )}
                      </Box>
                    </HStack>
                  </Card.Pressable>
                );
              })}
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
                accessibilityLabel={t("qada.daysBeforeRamadan")}
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
                  padding: 16,
                  borderRadius: 12,
                  fontSize: 18,
                  fontWeight: "600",
                  borderWidth: 1,
                  borderColor: daysError ? theme.error.val : theme.outline.val,
                  color: theme.typography.val,
                  backgroundColor: theme.backgroundSecondary.val,
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
              <Card.Pressable
                onPress={() => setShowDatePicker(true)}
                accessibilityRole="button"
                accessibilityLabel={t("a11y.qada.selectDate")}
                borderWidth={1}
                borderColor="$outline"
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
              </Card.Pressable>
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
                  onValueChange={(_event, selectedDate) => {
                    setShowDatePicker(false);
                    setTempCustomDate(selectedDate.toISOString());
                  }}
                  onDismiss={() => setShowDatePicker(false)}
                />
              )}
            </VStack>
          )}

          {/* Privacy Mode */}
          {tempReminderType !== "none" && (
            <VStack gap="$2">
              <Pressable
                // Holds text or a control the reader must reach; as one element iOS would hide them.
                accessible={false}
                onPress={() => setTempPrivacyMode(!tempPrivacyMode)}
                accessibilityRole="button"
                accessibilityLabel={t("qada.privacyMode")}
                accessibilityState={{ expanded: tempPrivacyMode }}
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
                  <Switch
                    value={tempPrivacyMode}
                    onValueChange={setTempPrivacyMode}
                    accessibilityLabel={t("qada.privacyMode")}
                  />
                </HStack>
              </Pressable>

              {/* Privacy Example */}
              <Card padding="$3" borderWidth={1} borderColor="$outline">
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
              </Card>
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
                // Holds text or a control the reader must reach; as one element iOS would hide them.
                accessible={false}
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
                  <Switch
                    value={tempQadaVibration}
                    onValueChange={setTempQadaVibration}
                    accessibilityLabel={t("notification.vibration")}
                  />
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
              accessibilityRole="button"
              accessibilityState={{ expanded: dangerZoneExpanded }}
              accessibilityLabel={t("qada.dangerZone.title")}
              padding="$4"
              borderRadius="$6"
              borderWidth={1}
              borderColor="$error"
              backgroundColor="$background">
              <HStack alignItems="center" justifyContent="space-between">
                <HStack alignItems="center" flex={1} gap="$3">
                  <Icon as={TriangleAlert} size="md" color="$error" />
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

                <HoldToConfirm
                  label={t("qada.resetAll")}
                  icon={RotateCcw}
                  busy={isResetting}
                  onConfirm={handleResetComplete}
                  screenReaderConfirm={{
                    title: t("qada.dangerZone.resetTitle"),
                    message: t("qada.dangerZone.resetDescription"),
                    confirmLabel: t("qada.reset"),
                    cancelLabel: t("common.cancel"),
                  }}
                />
              </VStack>
            )}
          </VStack>
        </Box>
      )}
    </Background>
  );
};

export default QadaSettings;
