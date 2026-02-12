import { useTranslation } from "react-i18next";
import { ScrollView, Platform } from "react-native";
import { useLocalSearchParams } from "expo-router";

import { Box } from "@/components/ui/box";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Background } from "@/components/ui/background";
import TopBar from "@/components/TopBar";

import {
  SoundPicker,
  VolumeSlider,
  ChallengePicker,
  VibrationSettings,
  SnoozeSettings,
  TimingSettings,
} from "@/components/alarm";

import { Volume2, Brain, Vibrate, Clock, Timer } from "lucide-react-native";

import * as ExpoAlarm from "expo-alarm";

import { useAlarmSettingsStore } from "@/stores/alarmSettings";
import { useAlarmStore } from "@/stores/alarm";
import { scheduleFajrAlarm, scheduleFridayAlarm } from "@/utils/alarmScheduler";
import { AlarmType, AlarmTypeSettings } from "@/types/alarm";
import { useHaptic } from "@/hooks/useHaptic";
import { SOUND_ASSETS } from "@/constants/sounds";

// Get native sound filename (without extension) from sound key
const getNativeSoundName = (soundKey: string): string => {
  const asset = SOUND_ASSETS[soundKey as keyof typeof SOUND_ASSETS];
  if (!asset?.notificationSound) return soundKey;
  // Remove extension (.caf, .ogg, etc.)
  return asset.notificationSound.replace(/\.[^.]+$/, "");
};

type SettingsSectionProps = {
  title: string;
  icon: React.ComponentType<any>;
  children: React.ReactNode;
};

const SettingsSection = ({ title, icon, children }: SettingsSectionProps) => (
  <Card className="mx-4 mb-4 p-4 rounded-2xl bg-background-secondary">
    <VStack space="md">
      <HStack className="items-center" space="sm">
        <Box className="w-8 h-8 rounded-lg bg-surface-active items-center justify-center">
          <Icon as={icon} size="md" className="text-typography" />
        </Box>
        <Text className="text-base font-semibold text-typography">{title}</Text>
      </HStack>
      {children}
    </VStack>
  </Card>
);

const AlarmTypeSettingsScreen = () => {
  const { t } = useTranslation();
  const { type } = useLocalSearchParams<{ type: string }>();
  const alarmType = type as AlarmType;
  const hapticSelection = useHaptic("selection");

  const settings = useAlarmSettingsStore((state) =>
    alarmType === "fajr" ? state.fajr : state.friday
  );
  const updateSettings = useAlarmSettingsStore((state) => state.updateSettings);

  const handleChange = (changes: Partial<AlarmTypeSettings>) => {
    updateSettings(alarmType, changes);

    // Sync to native settings (both platforms)
    const nativeSettings: Record<string, unknown> = {};
    if (changes.enabled !== undefined) nativeSettings.enabled = changes.enabled;
    if (changes.sound !== undefined) nativeSettings.sound = getNativeSoundName(changes.sound);
    if (changes.volume !== undefined) nativeSettings.volume = changes.volume;

    // Android-specific settings
    if (Platform.OS === "android") {
      if (changes.challenge) {
        nativeSettings.challengeType = changes.challenge.type;
        nativeSettings.challengeDifficulty = changes.challenge.difficulty;
        nativeSettings.challengeCount = changes.challenge.count;
      }
      if (changes.vibration) {
        nativeSettings.vibrationEnabled = changes.vibration.enabled;
        nativeSettings.vibrationPattern = changes.vibration.pattern;
      }
      if (changes.snooze) {
        nativeSettings.snoozeEnabled = changes.snooze.enabled;
        nativeSettings.snoozeMaxCount = changes.snooze.maxCount;
        nativeSettings.snoozeDuration = changes.snooze.durationMinutes;
      }
      if (changes.timing) {
        nativeSettings.timingMode = changes.timing.mode;
        nativeSettings.timingMinutesBefore = changes.timing.minutesBefore;
      }
    }

    // Sync to native
    if (Object.keys(nativeSettings).length > 0) {
      ExpoAlarm.setAlarmSettings(alarmType, nativeSettings).catch((e: unknown) =>
        console.warn("Failed to sync alarm settings to native:", e)
      );
    }
  };

  const handleEnabledToggle = async (enabled: boolean) => {
    hapticSelection();
    handleChange({ enabled });

    try {
      if (enabled) {
        if (alarmType === "fajr") {
          await scheduleFajrAlarm();
        } else {
          await scheduleFridayAlarm();
        }
      } else {
        const cancelType = alarmType === "fajr" ? "fajr" : "jummah";
        await useAlarmStore.getState().cancelAlarmsByType(cancelType);
      }
    } catch {
      handleChange({ enabled: !enabled });
    }
  };

  const title =
    alarmType === "fajr" ? t("alarm.settings.fajrAlarm") : t("alarm.settings.fridayAlarm");

  const backHref = "/settings/alarm";

  return (
    <Background>
      <TopBar title={title} href={backHref} backOnClick />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}>
        <VStack className="flex-1 pt-4">
          {/* Enable Toggle */}
          <Card className="mx-4 mb-4 p-4 rounded-2xl bg-background-secondary">
            <HStack className="justify-between items-center">
              <VStack className="flex-1 me-4">
                <Text className="text-left text-lg font-semibold text-typography">
                  {t("alarm.settings.enableAlarm")}
                </Text>
                <Text className="text-left text-sm text-typography-secondary">
                  {alarmType === "fajr"
                    ? t("alarm.settings.fajrEnableDescription")
                    : t("alarm.settings.fridayEnableDescription")}
                </Text>
              </VStack>
              <Switch value={settings.enabled} onValueChange={handleEnabledToggle} size="md" />
            </HStack>
          </Card>

          {settings.enabled && (
            <>
              {/* Timing Settings */}
              <SettingsSection title={t("alarm.settings.timing")} icon={Timer}>
                <Text className="text-left text-sm text-typography-secondary mb-2">
                  {alarmType === "fajr"
                    ? t("alarm.settings.timingDescriptionFajr")
                    : t("alarm.settings.timingDescriptionFriday")}
                </Text>
                <TimingSettings
                  value={settings.timing}
                  alarmType={alarmType}
                  onChange={(timing) => handleChange({ timing })}
                />
              </SettingsSection>

              {/* Sound Settings */}
              <SettingsSection title={t("alarm.settings.sound")} icon={Volume2}>
                <SoundPicker value={settings.sound} onChange={(sound) => handleChange({ sound })} />

                <VStack space="sm" className="mt-3 pt-3 border-t border-outline-secondary">
                  <Text className="text-sm text-typography-secondary">
                    {t("alarm.settings.volume")}
                  </Text>
                  <VolumeSlider
                    value={settings.volume}
                    onChange={(volume) => handleChange({ volume })}
                  />
                </VStack>
              </SettingsSection>

              {/* Challenge Settings */}
              <SettingsSection title={t("alarm.settings.challenge")} icon={Brain}>
                <Text className="text-left text-sm text-typography-secondary mb-2">
                  {t("alarm.settings.challengeDescription")}
                </Text>
                <ChallengePicker
                  value={settings.challenge}
                  onChange={(challenge) => handleChange({ challenge })}
                />
              </SettingsSection>

              {/* Vibration Settings */}
              <SettingsSection title={t("alarm.settings.vibration")} icon={Vibrate}>
                <VibrationSettings
                  value={settings.vibration}
                  onChange={(vibration) => handleChange({ vibration })}
                />
              </SettingsSection>

              {/* Snooze Settings */}
              <SettingsSection title={t("alarm.settings.snooze")} icon={Clock}>
                <SnoozeSettings
                  value={settings.snooze}
                  onChange={(snooze) => handleChange({ snooze })}
                />
              </SettingsSection>
            </>
          )}
        </VStack>
      </ScrollView>
    </Background>
  );
};

export default AlarmTypeSettingsScreen;
