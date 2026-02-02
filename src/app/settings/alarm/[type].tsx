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
import { Button, ButtonText, ButtonIcon } from "@/components/ui/button";
import { Background } from "@/components/ui/background";
import TopBar from "@/components/TopBar";

import {
  SoundPicker,
  VolumeSlider,
  ChallengePicker,
  GentleWakeUpSettings,
  VibrationSettings,
  SnoozeSettings,
} from "@/components/alarm";

import { Volume2, Brain, Sunrise, Vibrate, Clock, ExternalLink } from "lucide-react-native";

import * as ExpoAlarm from "expo-alarm";

import { useAlarmSettingsStore } from "@/stores/alarmSettings";
import { AlarmType, AlarmTypeSettings } from "@/types/alarm";
import { useHaptic } from "@/hooks/useHaptic";

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

    // Sync to native settings on Android
    if (Platform.OS === "android") {
      const nativeSettings: Record<string, unknown> = {};
      if (changes.enabled !== undefined) nativeSettings.enabled = changes.enabled;
      if (changes.sound !== undefined) nativeSettings.sound = changes.sound;
      if (changes.volume !== undefined) nativeSettings.volume = changes.volume;
      if (changes.challenge) {
        nativeSettings.challengeType = changes.challenge.type;
        nativeSettings.challengeDifficulty = changes.challenge.difficulty;
        nativeSettings.challengeCount = changes.challenge.count;
      }
      if (changes.gentleWakeUp) {
        nativeSettings.gentleWakeUpEnabled = changes.gentleWakeUp.enabled;
        nativeSettings.gentleWakeUpDuration = changes.gentleWakeUp.durationMinutes;
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

      if (Object.keys(nativeSettings).length > 0) {
        ExpoAlarm.setAlarmSettings(alarmType, nativeSettings).catch(() => {});
      }
    }
  };

  const handleEnabledToggle = (enabled: boolean) => {
    hapticSelection();
    handleChange({ enabled });
  };

  const handleOpenNativeSettings = () => {
    hapticSelection();
    ExpoAlarm.openNativeSettings(alarmType);
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
              <VStack className="flex-1 mr-4">
                <Text className="text-lg font-semibold text-typography">
                  {t("alarm.settings.enableAlarm")}
                </Text>
                <Text className="text-sm text-typography-secondary">
                  {alarmType === "fajr"
                    ? t("alarm.settings.fajrEnableDescription")
                    : t("alarm.settings.fridayEnableDescription")}
                </Text>
              </VStack>
              <Switch value={settings.enabled} onValueChange={handleEnabledToggle} size="md" />
            </HStack>
          </Card>

          {/* Android Native Settings Button */}
          {Platform.OS === "android" && settings.enabled && (
            <Card className="mx-4 mb-4 p-4 rounded-2xl bg-background-secondary">
              <VStack space="sm">
                <Text className="text-sm text-typography-secondary">
                  {t("alarm.settings.nativeSettingsDescription")}
                </Text>
                <Button variant="outline" onPress={handleOpenNativeSettings}>
                  <ButtonText>{t("alarm.settings.openNativeSettings")}</ButtonText>
                  <ButtonIcon as={ExternalLink} className="ml-2" />
                </Button>
              </VStack>
            </Card>
          )}

          {settings.enabled && (
            <>
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

              {/* Gentle Wake-up */}
              <SettingsSection title={t("alarm.settings.gentleWakeUp")} icon={Sunrise}>
                <Text className="text-sm text-typography-secondary mb-2">
                  {t("alarm.settings.gentleWakeUpDescription")}
                </Text>
                <GentleWakeUpSettings
                  value={settings.gentleWakeUp}
                  onChange={(gentleWakeUp) => handleChange({ gentleWakeUp })}
                />
              </SettingsSection>

              {/* Challenge Settings */}
              <SettingsSection title={t("alarm.settings.challenge")} icon={Brain}>
                <Text className="text-sm text-typography-secondary mb-2">
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
