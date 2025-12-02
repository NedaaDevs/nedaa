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
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
  ActionsheetFlatList,
} from "@/components/ui/actionsheet";
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
  Clock,
  Check,
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
import type { AlarmSettings, AlarmType, MathDifficulty, AlarmChallengeType } from "@/types/alarm";

// Constants
import { getAlarmSound } from "@/constants/AlarmSounds";
import {
  SNOOZE_DURATIONS,
  MATH_DIFFICULTIES,
  MATH_QUESTION_COUNTS,
  TAP_COUNTS,
  GRACE_PERIODS,
} from "@/constants/AlarmOptions";

// Utils
import { isSystemAlarmSoundKey } from "@/services/alarm/sounds";

// Contexts
import { useRTL } from "@/contexts/RTLContext";

// ==========================================
// TYPES
// ==========================================

type SettingOption<T> = {
  value: T;
  label: string;
  description?: string;
};

type ActiveSheet =
  | "timeMode"
  | "offset"
  | "snooze"
  | "challengeType"
  | "mathDifficulty"
  | "mathQuestions"
  | "tapCount"
  | "gracePeriod"
  | null;

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
  const [activeSheet, setActiveSheet] = useState<ActiveSheet>(null);

  // ==========================================
  // OPTIONS DATA
  // ==========================================

  const timeModeOptions: SettingOption<"dynamic" | "fixed">[] = [
    {
      value: "dynamic",
      label: t("alarm.settings.dynamic", "Follow Prayer"),
      description: t("alarm.settings.dynamicDesc", "Alarm adjusts with prayer time"),
    },
    {
      value: "fixed",
      label: t("alarm.settings.fixed", "Fixed Time"),
      description: t("alarm.settings.fixedDesc", "Alarm at the same time daily"),
    },
  ];

  const fajrOffsetOptions: SettingOption<number>[] = [
    { value: -120, label: t("alarm.offset.beforeHours", { count: 2 }) },
    { value: -90, label: t("alarm.offset.beforeHourAndHalf", "1.5 hours before") },
    { value: -60, label: t("alarm.offset.beforeHours", { count: 1 }) },
    { value: -30, label: t("alarm.offset.before", { count: 30 }) },
    { value: -15, label: t("alarm.offset.before", { count: 15 }) },
    { value: 0, label: t("alarm.offset.atTime", "At prayer time") },
    { value: 5, label: t("alarm.offset.after", { count: 5 }) },
    { value: 10, label: t("alarm.offset.after", { count: 10 }) },
  ];

  const jummahOffsetOptions: SettingOption<number>[] = [
    { value: -120, label: t("alarm.offset.beforeHours", { count: 2 }) },
    { value: -90, label: t("alarm.offset.beforeHourAndHalf", "1.5 hours before") },
    { value: -60, label: t("alarm.offset.beforeHours", { count: 1 }) },
    { value: -30, label: t("alarm.offset.before", { count: 30 }) },
    { value: -15, label: t("alarm.offset.before", { count: 15 }) },
  ];

  const offsetOptions = isFajr ? fajrOffsetOptions : jummahOffsetOptions;

  const snoozeOptions: SettingOption<number>[] = SNOOZE_DURATIONS.map((duration) => ({
    value: duration,
    label: t("common.minute", { count: duration }),
  }));

  const challengeTypeOptions: SettingOption<AlarmChallengeType>[] = [
    {
      value: "none",
      label: t("alarm.challenge.none", "None"),
      description: t("alarm.challenge.noneDesc", "Dismiss with a simple tap"),
    },
    {
      value: "math",
      label: t("alarm.challenge.math", "Math Problem"),
      description: t("alarm.challenge.mathDesc", "Solve math to dismiss"),
    },
    {
      value: "tap",
      label: t("alarm.challenge.tap", "Tap Challenge"),
      description: t("alarm.challenge.tapDesc", "Tap multiple times to dismiss"),
    },
  ];

  const mathDifficultyDescriptions: Record<MathDifficulty, string> = {
    easy: "1 + 2 = ?",
    medium: "12 + 8 = ?",
    hard: "23 × 4 = ?",
  };

  const mathDifficultyOptions: SettingOption<MathDifficulty>[] = MATH_DIFFICULTIES.map(
    (difficulty) => ({
      value: difficulty,
      label: t(`alarm.difficulty.${difficulty}`, difficulty),
      description: mathDifficultyDescriptions[difficulty],
    })
  );

  const mathQuestionsOptions: SettingOption<number>[] = MATH_QUESTION_COUNTS.map((count) => ({
    value: count,
    label: t("alarm.questions", { count }),
  }));

  const tapCountOptions: SettingOption<number>[] = TAP_COUNTS.map((count) => ({
    value: count,
    label: t("alarm.taps", { count }),
  }));

  const gracePeriodOptions: SettingOption<number>[] = GRACE_PERIODS.map((seconds) => ({
    value: seconds,
    label: t("alarm.grace", { count: seconds }),
  }));

  // ==========================================
  // DISPLAY HELPERS
  // ==========================================

  const getSoundDisplayName = useCallback((): string => {
    const soundKey = settings.sound;
    if (soundKey === "default") return t("alarm.sound.default", "Default");
    if (isSystemAlarmSoundKey(soundKey)) return t("alarm.sound.systemSound", "System Alarm");
    const alarmSound = getAlarmSound(soundKey as any);
    if (alarmSound?.label) return t(alarmSound.label);
    return soundKey;
  }, [settings.sound, t]);

  const getTimeModeDisplay = () =>
    timeModeOptions.find((o) => o.value === settings.timeMode)?.label || "";

  const getOffsetDisplay = () => {
    const option = offsetOptions.find((o) => o.value === settings.offsetMinutes);
    return option?.label || `${settings.offsetMinutes} min`;
  };

  const getSnoozeDisplay = () => {
    if (!settings.snoozeEnabled) return t("alarm.snooze.off", "Off");
    return snoozeOptions.find((o) => o.value === settings.snoozeDurationMinutes)?.label || "";
  };

  const getChallengeDisplay = () => {
    if (!settings.challengeEnabled) return t("alarm.challenge.none", "None");
    return challengeTypeOptions.find((o) => o.value === settings.challengeType)?.label || "";
  };

  const getDifficultyDisplay = () =>
    mathDifficultyOptions.find((o) => o.value === settings.mathDifficulty)?.label || "";

  const getQuestionsDisplay = () =>
    mathQuestionsOptions.find((o) => o.value === settings.mathQuestionCount)?.label || "";

  const getTapCountDisplay = () =>
    tapCountOptions.find((o) => o.value === settings.tapCount)?.label || "";

  const getGracePeriodDisplay = () =>
    gracePeriodOptions.find((o) => o.value === settings.challengeGracePeriodSec)?.label || "";

  // ==========================================
  // HANDLERS
  // ==========================================

  const handleSettingChange = useCallback(
    async <K extends keyof AlarmSettings>(key: K, value: AlarmSettings[K]) => {
      hapticSelection();
      try {
        await updateSettings({ [key]: value });
      } catch (error) {
        const message = error instanceof Error ? error.message : t("alarm.error.unknown");
        Alert.alert(t("alarm.error.title", "Alarm Error"), message);
      }
    },
    [updateSettings, hapticSelection, t]
  );

  const handleSnoozeSelect = (value: number) => {
    handleSettingChange("snoozeEnabled", true);
    handleSettingChange("snoozeDurationMinutes", value);
    setActiveSheet(null);
  };

  const handleChallengeTypeSelect = (value: AlarmChallengeType) => {
    if (value === "none") {
      handleSettingChange("challengeEnabled", false);
    } else {
      handleSettingChange("challengeEnabled", true);
      handleSettingChange("challengeType", value);
    }
    setActiveSheet(null);
  };

  const handleDeleteAlarm = () => {
    Alert.alert(
      t("alarm.edit.deleteConfirm.title", "Delete Alarm"),
      t(
        "alarm.edit.deleteConfirm.message",
        "Are you sure you want to delete this alarm? All settings will be reset."
      ),
      [
        { text: t("common.cancel", "Cancel"), style: "cancel" },
        {
          text: t("common.delete", "Delete"),
          style: "destructive",
          onPress: async () => {
            await updateSettings({ enabled: false, hasCompletedSetup: false });
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

      const occurrence =
        todayAlarm > now ? t("alarm.card.today", "Today") : t("alarm.card.tomorrow", "Tomorrow");
      return t("alarm.edit.preview", "Next alarm: {{time}}", {
        time: `${occurrence} ${timeString}`,
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
      const occurrence =
        alarmDate > now ? t("alarm.card.today", "Today") : t("alarm.card.tomorrow", "Tomorrow");
      return t("alarm.edit.preview", "Next alarm: {{time}}", {
        time: `${occurrence} ${timeString}`,
      });
    }
  };

  const previewText = getPreviewTime();

  // ==========================================
  // SETTING ROW COMPONENT
  // ==========================================

  const SettingRow = ({
    icon,
    label,
    value,
    onPress,
    showChevron = true,
  }: {
    icon: any;
    label: string;
    value: string;
    onPress: () => void;
    showChevron?: boolean;
  }) => (
    <Pressable onPress={onPress} className="py-4">
      <HStack className="justify-between items-center">
        <HStack className="items-center gap-3 flex-1">
          <Icon as={icon} size="sm" className="text-typography-secondary" />
          <Text className="text-base text-typography">{label}</Text>
        </HStack>
        <HStack className="items-center gap-2">
          <Text className="text-base text-primary" numberOfLines={1}>
            {value}
          </Text>
          {showChevron && <Icon as={ChevronIcon} size="sm" className="text-typography-secondary" />}
        </HStack>
      </HStack>
    </Pressable>
  );

  const ToggleRow = ({
    icon,
    label,
    value,
    onValueChange,
  }: {
    icon: any;
    label: string;
    value: boolean;
    onValueChange: (v: boolean) => void;
  }) => (
    <HStack className="justify-between items-center py-4">
      <HStack className="items-center gap-3 flex-1">
        <Icon as={icon} size="sm" className="text-typography-secondary" />
        <Text className="text-base text-typography">{label}</Text>
      </HStack>
      <Switch value={value} onValueChange={onValueChange} />
    </HStack>
  );

  // ==========================================
  // ACTIONSHEET RENDERER
  // ==========================================

  const renderOptionSheet = <T,>(
    options: SettingOption<T>[],
    currentValue: T,
    onSelect: (value: T) => void,
    title: string
  ) => (
    <Actionsheet isOpen={activeSheet !== null} onClose={() => setActiveSheet(null)}>
      <ActionsheetBackdrop />
      <ActionsheetContent className="bg-background-secondary">
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>
        <Text className="text-lg font-semibold text-typography mb-4 px-4">{title}</Text>
        <ActionsheetFlatList
          data={options}
          keyExtractor={(item: any) => String(item.value)}
          renderItem={({ item, index }: any) => {
            const isSelected = item.value === currentValue;
            return (
              <Pressable
                onPress={() => {
                  hapticSelection();
                  onSelect(item.value);
                  setActiveSheet(null);
                }}
                className={`py-4 px-4 flex-row justify-between items-center ${
                  index < options.length - 1 ? "border-b border-outline" : ""
                }`}>
                <VStack className="flex-1">
                  <Text
                    className={`text-base ${isSelected ? "text-primary font-semibold" : "text-typography"}`}>
                    {item.label}
                  </Text>
                  {item.description && (
                    <Text className="text-sm text-typography-secondary mt-0.5">
                      {item.description}
                    </Text>
                  )}
                </VStack>
                {isSelected && <Icon as={Check} className="text-primary" size="md" />}
              </Pressable>
            );
          }}
        />
      </ActionsheetContent>
    </Actionsheet>
  );

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
          <Box className="w-12 h-12 rounded-full bg-primary/20 items-center justify-center">
            <Icon as={TitleIcon} className="text-primary" size="lg" />
          </Box>
          <VStack>
            <Text className="text-xl font-semibold text-typography">
              {isFajr
                ? t("alarm.fajrPrayer", "Fajr Alarm")
                : t("alarm.jummahPrayer", "Jummah Alarm")}
            </Text>
            {previewText && <Text className="text-sm text-primary">{previewText}</Text>}
          </VStack>
        </HStack>

        {/* TIME SETTINGS */}
        <Box className="bg-background-secondary rounded-xl px-4 mb-4">
          <SettingRow
            icon={Clock}
            label={t("alarm.settings.timeMode", "Time Mode")}
            value={getTimeModeDisplay()}
            onPress={() => setActiveSheet("timeMode")}
          />

          {settings.timeMode === "dynamic" && (
            <SettingRow
              icon={Clock}
              label={t("alarm.settings.offset", "Time Offset")}
              value={getOffsetDisplay()}
              onPress={() => setActiveSheet("offset")}
            />
          )}

          {settings.timeMode === "fixed" && (
            <SettingRow
              icon={Clock}
              label={t("alarm.settings.fixedTime", "Alarm Time")}
              value={`${String(settings.fixedHour ?? 5).padStart(2, "0")}:${String(settings.fixedMinute ?? 0).padStart(2, "0")}`}
              onPress={() => setShowTimePicker(true)}
            />
          )}
        </Box>

        {/* SNOOZE & CHALLENGE */}
        <Box className="bg-background-secondary rounded-xl px-4 mb-4">
          <SettingRow
            icon={RefreshCw}
            label={t("alarm.settings.snooze", "Snooze")}
            value={getSnoozeDisplay()}
            onPress={() => setActiveSheet("snooze")}
          />

          {Platform.OS === "android" && (
            <>
              <SettingRow
                icon={Zap}
                label={t("alarm.settings.challenge", "Dismiss Challenge")}
                value={getChallengeDisplay()}
                onPress={() => setActiveSheet("challengeType")}
              />

              {settings.challengeEnabled && settings.challengeType === "math" && (
                <>
                  <SettingRow
                    icon={Zap}
                    label={t("alarm.settings.difficulty", "Difficulty")}
                    value={getDifficultyDisplay()}
                    onPress={() => setActiveSheet("mathDifficulty")}
                  />
                  <SettingRow
                    icon={Zap}
                    label={t("alarm.settings.questions", "Problems")}
                    value={getQuestionsDisplay()}
                    onPress={() => setActiveSheet("mathQuestions")}
                  />
                </>
              )}

              {settings.challengeEnabled && settings.challengeType === "tap" && (
                <SettingRow
                  icon={Zap}
                  label={t("alarm.settings.tapCount", "Tap Count")}
                  value={getTapCountDisplay()}
                  onPress={() => setActiveSheet("tapCount")}
                />
              )}

              {settings.challengeEnabled && (
                <SettingRow
                  icon={Zap}
                  label={t("alarm.settings.gracePeriod", "Grace Period")}
                  value={getGracePeriodDisplay()}
                  onPress={() => setActiveSheet("gracePeriod")}
                />
              )}
            </>
          )}
        </Box>

        {/* SOUND & VIBRATION */}
        <Box className="bg-background-secondary rounded-xl px-4 mb-4">
          {/* Sound picker - Android only, iOS uses system default */}
          {Platform.OS === "android" && (
            <SettingRow
              icon={Music}
              label={t("alarm.settings.sound", "Alarm Sound")}
              value={getSoundDisplayName()}
              onPress={() => setShowSoundPicker(true)}
            />
          )}

          {/* Gradual volume & Vibration - Android only, iOS AlarmKit doesn't support them */}
          {Platform.OS === "android" && (
            <>
              <ToggleRow
                icon={Volume2}
                label={t("alarm.settings.gradualVolume", "Gradual Volume")}
                value={settings.gradualVolume}
                onValueChange={(v) => handleSettingChange("gradualVolume", v)}
              />
              <ToggleRow
                icon={Vibrate}
                label={t("alarm.settings.vibration", "Vibration")}
                value={settings.vibration}
                onValueChange={(v) => handleSettingChange("vibration", v)}
              />
            </>
          )}

          {Platform.OS === "android" && (
            <ToggleRow
              icon={Moon}
              label={t("alarm.settings.overrideDnd", "Override Do Not Disturb")}
              value={settings.overrideDnd}
              onValueChange={(v) => handleSettingChange("overrideDnd", v)}
            />
          )}
        </Box>

        {/* DELETE ALARM */}
        <Button
          size="lg"
          variant="outline"
          className="w-full border-error mb-4"
          onPress={handleDeleteAlarm}>
          <HStack className="items-center gap-2">
            <Icon as={Trash2} size="sm" className="text-error" />
            <ButtonText className="text-error">{t("alarm.edit.delete", "Delete Alarm")}</ButtonText>
          </HStack>
        </Button>
      </ScrollView>

      {/* TIME PICKER */}
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

      {/* SOUND PICKER */}
      <AlarmSoundPicker
        isOpen={showSoundPicker}
        onClose={() => setShowSoundPicker(false)}
        selectedSound={settings.sound}
        onSelectSound={(sound) => handleSettingChange("sound", sound)}
      />

      {/* OPTION SHEETS */}
      {activeSheet === "timeMode" &&
        renderOptionSheet(
          timeModeOptions,
          settings.timeMode,
          (v) => {
            handleSettingChange("timeMode", v);
            setActiveSheet(null);
          },
          t("alarm.settings.timeMode", "Time Mode")
        )}

      {activeSheet === "offset" &&
        renderOptionSheet(
          offsetOptions,
          settings.offsetMinutes,
          (v) => {
            handleSettingChange("offsetMinutes", v);
            setActiveSheet(null);
          },
          t("alarm.settings.offset", "Time Offset")
        )}

      {activeSheet === "snooze" &&
        renderOptionSheet(
          snoozeOptions,
          settings.snoozeEnabled ? settings.snoozeDurationMinutes : 0,
          handleSnoozeSelect,
          t("alarm.settings.snooze", "Snooze")
        )}

      {activeSheet === "challengeType" &&
        renderOptionSheet(
          challengeTypeOptions,
          settings.challengeEnabled ? settings.challengeType : "none",
          handleChallengeTypeSelect,
          t("alarm.settings.challenge", "Dismiss Challenge")
        )}

      {activeSheet === "mathDifficulty" &&
        renderOptionSheet(
          mathDifficultyOptions,
          settings.mathDifficulty,
          (v) => {
            handleSettingChange("mathDifficulty", v);
            setActiveSheet(null);
          },
          t("alarm.settings.difficulty", "Difficulty")
        )}

      {activeSheet === "mathQuestions" &&
        renderOptionSheet(
          mathQuestionsOptions,
          settings.mathQuestionCount,
          (v) => {
            handleSettingChange("mathQuestionCount", v);
            setActiveSheet(null);
          },
          t("alarm.settings.questions", "Number of Problems")
        )}

      {activeSheet === "tapCount" &&
        renderOptionSheet(
          tapCountOptions,
          settings.tapCount,
          (v) => {
            handleSettingChange("tapCount", v);
            setActiveSheet(null);
          },
          t("alarm.settings.tapCount", "Tap Count")
        )}

      {activeSheet === "gracePeriod" &&
        renderOptionSheet(
          gracePeriodOptions,
          settings.challengeGracePeriodSec,
          (v) => {
            handleSettingChange("challengeGracePeriodSec", v);
            setActiveSheet(null);
          },
          t("alarm.settings.gracePeriod", "Grace Period")
        )}
    </Background>
  );
}
