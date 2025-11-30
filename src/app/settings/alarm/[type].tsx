import React, { useState, useCallback } from "react";
import { ScrollView, Platform, Alert } from "react-native";
import { useTranslation } from "react-i18next";
import { useLocalSearchParams, useRouter } from "expo-router";
import { parseISO, format } from "date-fns";

// Components
import { Box } from "@/components/ui/box";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { Switch } from "@/components/ui/switch";
import { Button, ButtonText } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { Background } from "@/components/ui/background";
import TopBar from "@/components/TopBar";
import TimePicker from "@/components/TimePicker";
import AlarmSoundPicker from "@/components/alarm/AlarmSoundPicker";

// Icons
import {
  Sun,
  CalendarDays,
  Volume2,
  Vibrate,
  Moon,
  Zap,
  RefreshCw,
  Trash2,
  Music,
  ChevronRight,
  ChevronLeft,
} from "lucide-react-native";

// Stores
import { useAlarmStore } from "@/stores/alarm";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import locationStore from "@/stores/location";

// Hooks
import { useHaptic } from "@/hooks/useHaptic";

// Utils
import { timeZonedNow } from "@/utils/date";

// Types
import type { AlarmSettings, AlarmType, MathDifficulty } from "@/types/alarm";

// Constants
import { getAlarmSound } from "@/constants/AlarmSounds";

// Utils
import { isSystemAlarmSoundKey } from "@/services/alarm/sounds";

// Contexts
import { useRTL } from "@/contexts/RTLContext";

// ==========================================
// COMPONENT
// ==========================================

export default function AlarmEditScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { type } = useLocalSearchParams<{ type: string }>();
  const hapticSelection = useHaptic("selection");
  const { isRTL } = useRTL();
  const ChevronIcon = isRTL ? ChevronLeft : ChevronRight;

  const alarmType = type as AlarmType;
  const isFajr = alarmType === "fajr";

  // Store
  const settings = useAlarmStore((state) => (isFajr ? state.fajrAlarm : state.jummahAlarm));
  const updateSettings = useAlarmStore((state) =>
    isFajr ? state.updateFajrAlarmSettings : state.updateJummahAlarmSettings
  );

  // Prayer times for preview
  const todayTimings = usePrayerTimesStore((state) => state.todayTimings);
  const tomorrowTimings = usePrayerTimesStore((state) => state.tomorrowTimings);
  const timezone = locationStore.getState().locationDetails.timezone;

  // Local state
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showSoundPicker, setShowSoundPicker] = useState(false);

  // Get display name for current sound
  const getSoundDisplayName = useCallback((): string => {
    const soundKey = settings.sound;

    // Check if it's the default system sound
    if (soundKey === "default") {
      return t("alarm.sound.default", "Default");
    }

    // Check if it's a system alarm sound
    if (isSystemAlarmSoundKey(soundKey)) {
      // For system sounds, we'd need to look up the title
      // For now, show a generic label or extract from the key
      return t("alarm.sound.systemSound", "System Alarm");
    }

    // It's an app sound
    const alarmSound = getAlarmSound(soundKey as any);
    if (alarmSound?.label) {
      return t(alarmSound.label);
    }

    return soundKey;
  }, [settings.sound, t]);

  // ==========================================
  // HANDLERS
  // ==========================================

  const handleSettingChange = useCallback(
    async <K extends keyof AlarmSettings>(key: K, value: AlarmSettings[K]) => {
      hapticSelection();
      await updateSettings({ [key]: value });
    },
    [updateSettings, hapticSelection]
  );

  const handleDeleteAlarm = () => {
    Alert.alert(
      t("alarm.edit.deleteConfirm.title", "Delete Alarm"),
      t(
        "alarm.edit.deleteConfirm.message",
        "Are you sure you want to delete this alarm? All settings will be reset."
      ),
      [
        {
          text: t("common.cancel", "Cancel"),
          style: "cancel",
        },
        {
          text: t("common.delete", "Delete"),
          style: "destructive",
          onPress: async () => {
            await updateSettings({
              enabled: false,
              hasCompletedSetup: false,
            });
            router.back();
          },
        },
      ]
    );
  };

  // ==========================================
  // PREVIEW CALCULATION
  // ==========================================

  const getPreviewTime = (): string | null => {
    const now = timeZonedNow(timezone);

    if (settings.timeMode === "fixed") {
      const hour = settings.fixedHour ?? 5;
      const minute = settings.fixedMinute ?? 0;
      const timeString = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;

      const todayAlarm = new Date(now);
      todayAlarm.setHours(hour, minute, 0, 0);

      if (todayAlarm > now) {
        return t("alarm.edit.preview", "Next alarm: {{time}}", {
          time: `${t("alarm.card.today", "Today")} ${timeString}`,
        });
      }
      return t("alarm.edit.preview", "Next alarm: {{time}}", {
        time: `${t("alarm.card.tomorrow", "Tomorrow")} ${timeString}`,
      });
    } else {
      const prayerTime = isFajr
        ? todayTimings?.timings?.fajr || tomorrowTimings?.timings?.fajr
        : todayTimings?.timings?.dhuhr;

      if (!prayerTime) return null;

      const prayerDate = parseISO(prayerTime);
      const offsetMs = (settings.offsetMinutes || 0) * 60 * 1000;
      const alarmDate = new Date(prayerDate.getTime() + offsetMs);
      const timeString = format(alarmDate, "HH:mm");

      if (alarmDate > now) {
        return t("alarm.edit.preview", "Next alarm: {{time}}", {
          time: `${t("alarm.card.today", "Today")} ${timeString}`,
        });
      }
      return t("alarm.edit.preview", "Next alarm: {{time}}", {
        time: `${t("alarm.card.tomorrow", "Tomorrow")} ${timeString}`,
      });
    }
  };

  const previewText = getPreviewTime();

  // ==========================================
  // RENDER
  // ==========================================

  const TitleIcon = isFajr ? Sun : CalendarDays;

  return (
    <Background>
      <TopBar
        title={
          isFajr
            ? t("alarm.edit.title.fajr", "Fajr Alarm Settings")
            : t("alarm.edit.title.jummah", "Jummah Alarm Settings")
        }
        href="/settings/alarm"
        backOnClick
      />
      <ScrollView
        className="flex-1 px-4 pt-2"
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}>
        {/* Header with Icon */}
        <HStack className="items-center gap-3 mb-6">
          <Box className="w-12 h-12 rounded-full bg-primary-500/20 items-center justify-center">
            <Icon as={TitleIcon} className="text-primary-500" size="lg" />
          </Box>
          <VStack>
            <Text className="text-xl font-semibold text-typography">
              {isFajr
                ? t("alarm.fajrPrayer", "Fajr Alarm")
                : t("alarm.jummahPrayer", "Jummah Alarm")}
            </Text>
            {previewText && <Text className="text-sm text-primary-500">{previewText}</Text>}
          </VStack>
        </HStack>

        {/* ==========================================
            SECTION: WAKE UP TIME
            ========================================== */}
        <Box className="bg-background-secondary rounded-xl p-4 mb-4">
          <Text className="text-sm font-semibold text-typography-secondary uppercase mb-4">
            {t("alarm.edit.section.time", "Wake Up Time")}
          </Text>

          {/* Time Mode Selection */}
          <HStack className="gap-2 mb-4">
            <Pressable
              className={`flex-1 py-3 px-4 rounded-lg ${
                settings.timeMode === "dynamic" ? "bg-primary-500" : "bg-background-tertiary"
              }`}
              onPress={() => handleSettingChange("timeMode", "dynamic")}>
              <Text
                className={`text-center font-medium ${
                  settings.timeMode === "dynamic" ? "text-white" : "text-typography"
                }`}>
                {t("alarm.settings.dynamic", "Follow Prayer")}
              </Text>
            </Pressable>
            <Pressable
              className={`flex-1 py-3 px-4 rounded-lg ${
                settings.timeMode === "fixed" ? "bg-primary-500" : "bg-background-tertiary"
              }`}
              onPress={() => handleSettingChange("timeMode", "fixed")}>
              <Text
                className={`text-center font-medium ${
                  settings.timeMode === "fixed" ? "text-white" : "text-typography"
                }`}>
                {t("alarm.settings.fixed", "Fixed Time")}
              </Text>
            </Pressable>
          </HStack>

          {/* Dynamic Mode: Offset Selection */}
          {settings.timeMode === "dynamic" && (
            <VStack space="sm">
              <Text className="text-sm text-typography-secondary">
                {t("alarm.settings.offset", "Time Offset")}
              </Text>
              <HStack className="gap-2 flex-wrap">
                {[-60, -30, -15, 0, 15, 30].map((offset) => (
                  <Pressable
                    key={offset}
                    className={`py-2 px-4 rounded-lg ${
                      settings.offsetMinutes === offset
                        ? "bg-primary-500"
                        : "bg-background-tertiary"
                    }`}
                    onPress={() => handleSettingChange("offsetMinutes", offset)}>
                    <Text
                      className={`text-sm font-medium ${
                        settings.offsetMinutes === offset ? "text-white" : "text-typography"
                      }`}>
                      {offset > 0 ? `+${offset}` : offset} min
                    </Text>
                  </Pressable>
                ))}
              </HStack>
            </VStack>
          )}

          {/* Fixed Mode: Time Picker */}
          {settings.timeMode === "fixed" && (
            <VStack space="sm">
              <Text className="text-sm text-typography-secondary">
                {t("alarm.settings.fixedTime", "Alarm Time")}
              </Text>
              <Pressable
                className="bg-background-tertiary py-4 px-4 rounded-lg"
                onPress={() => setShowTimePicker(true)}>
                <Text className="text-2xl text-typography text-center font-semibold">
                  {`${String(settings.fixedHour ?? 5).padStart(2, "0")}:${String(
                    settings.fixedMinute ?? 0
                  ).padStart(2, "0")}`}
                </Text>
              </Pressable>
              {showTimePicker && (
                <TimePicker
                  isVisible={showTimePicker}
                  currentHour={settings.fixedHour ?? 5}
                  currentMinute={settings.fixedMinute ?? 0}
                  onTimeChange={(hour, minute) => {
                    handleSettingChange("fixedHour", hour);
                    handleSettingChange("fixedMinute", minute);
                  }}
                  onClose={() => setShowTimePicker(false)}
                />
              )}
            </VStack>
          )}
        </Box>

        {/* ==========================================
            SECTION: SNOOZE
            ========================================== */}
        <Box className="bg-background-secondary rounded-xl p-4 mb-4">
          <Text className="text-sm font-semibold text-typography-secondary uppercase mb-4">
            {t("alarm.edit.section.snooze", "Snooze")}
          </Text>

          <HStack className="justify-between items-center mb-4">
            <HStack className="items-center gap-2">
              <Icon as={RefreshCw} size="sm" className="text-typography-secondary" />
              <Text className="text-base text-typography">
                {t("alarm.settings.snoozeEnabled", "Enabled")}
              </Text>
            </HStack>
            <Switch
              value={settings.snoozeEnabled}
              onValueChange={(v) => handleSettingChange("snoozeEnabled", v)}
              trackColor={{ false: "#3e3e3e", true: "#4CAF50" }}
            />
          </HStack>

          {settings.snoozeEnabled && (
            <HStack className="gap-2">
              {[5, 10, 15].map((duration) => (
                <Pressable
                  key={duration}
                  className={`flex-1 py-3 px-4 rounded-lg ${
                    settings.snoozeDurationMinutes === duration
                      ? "bg-primary-500"
                      : "bg-background-tertiary"
                  }`}
                  onPress={() => handleSettingChange("snoozeDurationMinutes", duration)}>
                  <Text
                    className={`text-center font-medium ${
                      settings.snoozeDurationMinutes === duration ? "text-white" : "text-typography"
                    }`}>
                    {duration} min
                  </Text>
                </Pressable>
              ))}
            </HStack>
          )}
        </Box>

        {/* ==========================================
            SECTION: DISMISS CHALLENGE (Android only - iOS AlarmKit handles its own UI)
            ========================================== */}
        {Platform.OS === "android" && (
          <Box className="bg-background-secondary rounded-xl p-4 mb-4">
            <Text className="text-sm font-semibold text-typography-secondary uppercase mb-4">
              {t("alarm.edit.section.challenge", "Dismiss Challenge")}
            </Text>

            <HStack className="justify-between items-center mb-4">
              <HStack className="items-center gap-2">
                <Icon as={Zap} size="sm" className="text-typography-secondary" />
                <Text className="text-base text-typography">
                  {t("alarm.settings.snoozeEnabled", "Enabled")}
                </Text>
              </HStack>
              <Switch
                value={settings.challengeEnabled}
                onValueChange={(v) => handleSettingChange("challengeEnabled", v)}
                trackColor={{ false: "#3e3e3e", true: "#4CAF50" }}
              />
            </HStack>

            {settings.challengeEnabled && (
              <VStack space="md">
                {/* Challenge Type */}
                <VStack space="sm">
                  <Text className="text-sm text-typography-secondary">
                    {t("alarm.edit.challengeType", "Type")}
                  </Text>
                  <HStack className="gap-2">
                    <Pressable
                      className={`flex-1 py-3 px-4 rounded-lg ${
                        settings.challengeType === "math"
                          ? "bg-primary-500"
                          : "bg-background-tertiary"
                      }`}
                      onPress={() => handleSettingChange("challengeType", "math")}>
                      <Text
                        className={`text-center font-medium ${
                          settings.challengeType === "math" ? "text-white" : "text-typography"
                        }`}>
                        {t("alarm.settings.math", "Math")}
                      </Text>
                    </Pressable>
                    <Pressable
                      className={`flex-1 py-3 px-4 rounded-lg ${
                        settings.challengeType === "tap"
                          ? "bg-primary-500"
                          : "bg-background-tertiary"
                      }`}
                      onPress={() => handleSettingChange("challengeType", "tap")}>
                      <Text
                        className={`text-center font-medium ${
                          settings.challengeType === "tap" ? "text-white" : "text-typography"
                        }`}>
                        {t("alarm.settings.tap", "Tap")}
                      </Text>
                    </Pressable>
                  </HStack>
                </VStack>

                {/* Math Difficulty */}
                {settings.challengeType === "math" && (
                  <>
                    <VStack space="sm">
                      <Text className="text-sm text-typography-secondary">
                        {t("alarm.edit.difficulty", "Difficulty")}
                      </Text>
                      <HStack className="gap-2">
                        {(["easy", "medium", "hard"] as MathDifficulty[]).map((diff) => (
                          <Pressable
                            key={diff}
                            className={`flex-1 py-3 px-3 rounded-lg ${
                              settings.mathDifficulty === diff
                                ? "bg-secondary-500"
                                : "bg-background-tertiary"
                            }`}
                            onPress={() => handleSettingChange("mathDifficulty", diff)}>
                            <Text
                              className={`text-center text-sm font-medium capitalize ${
                                settings.mathDifficulty === diff ? "text-white" : "text-typography"
                              }`}>
                              {t(`alarm.settings.difficulty.${diff}`, diff)}
                            </Text>
                          </Pressable>
                        ))}
                      </HStack>
                    </VStack>

                    {/* Math Question Count */}
                    <VStack space="sm">
                      <Text className="text-sm text-typography-secondary">
                        {t("alarm.edit.mathQuestionCount", "Number of Problems")}
                      </Text>
                      <HStack className="gap-2">
                        {[1, 2, 3, 5].map((count) => (
                          <Pressable
                            key={count}
                            className={`flex-1 py-3 px-3 rounded-lg ${
                              settings.mathQuestionCount === count
                                ? "bg-secondary-500"
                                : "bg-background-tertiary"
                            }`}
                            onPress={() => handleSettingChange("mathQuestionCount", count)}>
                            <Text
                              className={`text-center text-sm font-medium ${
                                settings.mathQuestionCount === count
                                  ? "text-white"
                                  : "text-typography"
                              }`}>
                              {count}
                            </Text>
                          </Pressable>
                        ))}
                      </HStack>
                    </VStack>
                  </>
                )}

                {/* Tap Count */}
                {settings.challengeType === "tap" && (
                  <VStack space="sm">
                    <Text className="text-sm text-typography-secondary">
                      {t("alarm.edit.tapCount", "Tap Count")}
                    </Text>
                    <HStack className="gap-2">
                      {[10, 20, 30, 50].map((count) => (
                        <Pressable
                          key={count}
                          className={`flex-1 py-3 px-3 rounded-lg ${
                            settings.tapCount === count
                              ? "bg-secondary-500"
                              : "bg-background-tertiary"
                          }`}
                          onPress={() => handleSettingChange("tapCount", count)}>
                          <Text
                            className={`text-center text-sm font-medium ${
                              settings.tapCount === count ? "text-white" : "text-typography"
                            }`}>
                            {count}x
                          </Text>
                        </Pressable>
                      ))}
                    </HStack>
                  </VStack>
                )}

                {/* Grace Period (common to both challenge types) */}
                <VStack space="sm">
                  <Text className="text-sm text-typography-secondary">
                    {t("alarm.edit.gracePeriod", "Grace Period")}
                  </Text>
                  <HStack className="gap-2">
                    {[0, 10, 15, 30].map((seconds) => (
                      <Pressable
                        key={seconds}
                        className={`flex-1 py-3 px-3 rounded-lg ${
                          settings.challengeGracePeriodSec === seconds
                            ? "bg-secondary-500"
                            : "bg-background-tertiary"
                        }`}
                        onPress={() => handleSettingChange("challengeGracePeriodSec", seconds)}>
                        <Text
                          className={`text-center text-sm font-medium ${
                            settings.challengeGracePeriodSec === seconds
                              ? "text-white"
                              : "text-typography"
                          }`}>
                          {seconds === 0 ? t("alarm.edit.gracePeriodNone", "None") : `${seconds}s`}
                        </Text>
                      </Pressable>
                    ))}
                  </HStack>
                  <Text className="text-xs text-typography-tertiary">
                    {t("alarm.edit.gracePeriodHint", "Alarm mutes while solving the challenge")}
                  </Text>
                </VStack>
              </VStack>
            )}
          </Box>
        )}

        {/* ==========================================
            SECTION: SOUND & VIBRATION
            ========================================== */}
        <Box className="bg-background-secondary rounded-xl p-4 mb-4">
          <Text className="text-sm font-semibold text-typography-secondary uppercase mb-4">
            {t("alarm.edit.section.sound", "Sound & Vibration")}
          </Text>

          <VStack space="md">
            {/* Sound Selection */}
            <Pressable onPress={() => setShowSoundPicker(true)} className="py-2">
              <HStack className="justify-between items-center">
                <HStack className="items-center gap-2">
                  <Icon as={Music} size="sm" className="text-typography-secondary" />
                  <Text className="text-base text-typography">
                    {t("alarm.settings.sound", "Alarm Sound")}
                  </Text>
                </HStack>
                <HStack className="items-center gap-2">
                  <Text className="text-base text-primary-500" numberOfLines={1}>
                    {getSoundDisplayName()}
                  </Text>
                  <Icon as={ChevronIcon} size="sm" className="text-typography-secondary" />
                </HStack>
              </HStack>
            </Pressable>

            {/* Gradual Volume */}
            <HStack className="justify-between items-center">
              <HStack className="items-center gap-2">
                <Icon as={Volume2} size="sm" className="text-typography-secondary" />
                <Text className="text-base text-typography">
                  {t("alarm.settings.gradualVolume", "Gradual Volume")}
                </Text>
              </HStack>
              <Switch
                value={settings.gradualVolume}
                onValueChange={(v) => handleSettingChange("gradualVolume", v)}
                trackColor={{ false: "#3e3e3e", true: "#4CAF50" }}
              />
            </HStack>

            {/* Vibration */}
            <HStack className="justify-between items-center">
              <HStack className="items-center gap-2">
                <Icon as={Vibrate} size="sm" className="text-typography-secondary" />
                <Text className="text-base text-typography">
                  {t("alarm.settings.vibration", "Vibration")}
                </Text>
              </HStack>
              <Switch
                value={settings.vibration}
                onValueChange={(v) => handleSettingChange("vibration", v)}
                trackColor={{ false: "#3e3e3e", true: "#4CAF50" }}
              />
            </HStack>

            {/* Override DND (Android only) */}
            {Platform.OS === "android" && (
              <HStack className="justify-between items-center">
                <HStack className="items-center gap-2">
                  <Icon as={Moon} size="sm" className="text-typography-secondary" />
                  <Text className="text-base text-typography">
                    {t("alarm.settings.overrideDnd", "Override Do Not Disturb")}
                  </Text>
                </HStack>
                <Switch
                  value={settings.overrideDnd}
                  onValueChange={(v) => handleSettingChange("overrideDnd", v)}
                  trackColor={{ false: "#3e3e3e", true: "#4CAF50" }}
                />
              </HStack>
            )}
          </VStack>
        </Box>

        {/* ==========================================
            DELETE ALARM
            ========================================== */}
        <Button
          size="lg"
          variant="outline"
          className="w-full border-error-500 mb-4"
          onPress={handleDeleteAlarm}>
          <HStack className="items-center gap-2">
            <Icon as={Trash2} size="sm" className="text-error-500" />
            <ButtonText className="text-error-500">
              {t("alarm.edit.delete", "Delete Alarm")}
            </ButtonText>
          </HStack>
        </Button>
      </ScrollView>

      {/* Sound Picker Modal */}
      <AlarmSoundPicker
        isOpen={showSoundPicker}
        onClose={() => setShowSoundPicker(false)}
        selectedSound={settings.sound}
        onSelectSound={(sound) => handleSettingChange("sound", sound)}
      />
    </Background>
  );
}
