import { useState, useEffect } from "react";
import { ScrollView, TextInput } from "react-native";
import { useTranslation } from "react-i18next";
import { router } from "expo-router";
import DateTimePicker from "@react-native-community/datetimepicker";

// Components
import { Background } from "@/components/ui/background";
import TopBar from "@/components/TopBar";
import SoundPreviewButton from "@/components/SoundPreviewButton";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { Pressable } from "@/components/ui/pressable";
import { Icon } from "@/components/ui/icon";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
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
} from "lucide-react-native";

const QadaSettings = () => {
  const { t } = useTranslation();
  const hapticSuccess = useHaptic("success");
  const { playPreview, stopPreview, isPlayingSound } = useSoundPreview();

  // Stores
  const { reminderType, reminderDays, customDate, privacyMode, updateSettings, getRemaining } =
    useQadaStore();
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
  const soundOptions = [
    {
      value: "default",
      label: "notification.sound.default",
      isPreviewable: false,
      isCustom: false,
    },
    ...baseSoundOptions,
  ];

  const getTranslatedSoundLabel = () => {
    const option = soundOptions.find((opt) => opt.value === tempQadaSound);
    return option ? t(option.label, option.label) : "";
  };

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

  return (
    <Background>
      <TopBar title="qada.notificationSettings" backOnClick={true} />

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        <VStack space="lg" className="px-4 py-6 pb-24">
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
                          tempReminderType === option.value ? "text-primary" : "text-typography"
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
            <VStack space="sm" className="p-4 bg-background rounded-xl border border-outline">
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

                    // Validate the number
                    if (text === "") {
                      setDaysError(null);
                    } else {
                      const num = parseInt(text);
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
                className={`text-center p-3 bg-background-secondary rounded-lg text-lg font-semibold text-typography border ${daysError ? "border-error" : "border-outline"}`}
                maxLength={3}
                placeholder="30"
              />
              {daysError && (
                <HStack className="items-center mt-2" space="xs">
                  <Icon as={Info} size="xs" className="text-error" />
                  <Text className="text-xs text-error">{daysError}</Text>
                </HStack>
              )}
            </VStack>
          )}

          {/* Custom Date Configuration */}
          {tempReminderType === "custom" && (
            <VStack space="sm" className="p-4 bg-background rounded-xl border border-outline">
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
                  <Icon as={CalendarDays} size="sm" className="text-typography-secondary" />
                </HStack>
              </Pressable>
              {tempCustomDate && new Date(tempCustomDate) < new Date() && (
                <HStack className="items-center mt-1" space="xs">
                  <Icon as={Info} size="xs" className="text-warning" />
                  <Text className="text-xs text-warning">{t("qada.dateInPast")}</Text>
                </HStack>
              )}

              {/* Date Picker Modal */}
              {showDatePicker && (
                <DateTimePicker
                  value={tempCustomDate ? new Date(tempCustomDate) : new Date()}
                  mode="date"
                  display="default"
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
                      <Text className="font-medium text-typography">{t("qada.privacyMode")}</Text>
                      <Text className="text-xs text-typography-secondary mt-0.5">
                        {tempPrivacyMode ? t("qada.privacyEnabled") : t("qada.privacyDisabled")}
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
                    {tempPrivacyMode ? t("qada.privacyEnabled") : t("qada.privacyDisabled")} -{" "}
                    {t("qada.notificationPreview")}
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
              <VStack space="xs" className="p-4 bg-background rounded-xl border border-outline">
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
                      !tempQadaSound || tempQadaSound === "silent" || tempQadaSound === "default"
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
                  <Switch value={tempQadaVibration} onValueChange={setTempQadaVibration} />
                </HStack>
              </Pressable>
            </VStack>
          )}

          {/* Save Button */}
          <Button
            size="lg"
            className="w-full bg-accent-primary mt-4"
            disabled={isSavingSettings || daysError !== null}
            onPress={handleSave}>
            {isSavingSettings ? (
              <Spinner size="small" color="white" />
            ) : (
              <ButtonText className="text-background font-medium">{t("common.save")}</ButtonText>
            )}
          </Button>
        </VStack>
      </ScrollView>
    </Background>
  );
};

export default QadaSettings;
