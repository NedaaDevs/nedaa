import { useRef, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, Platform } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { Box } from "@/components/ui/box";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Background } from "@/components/ui/background";
import { ScreenHeader } from "@/components/ui/screen-header";
import { BACK_DESTINATION } from "@/constants/BackDestinations";

import {
  SoundPicker,
  VolumeSlider,
  ChallengePicker,
  GentleWakeUpSettings,
  VibrationSettings,
  SnoozeSettings,
  TimingSettings,
} from "@/components/alarm";

import { Volume2, Brain, Vibrate, Clock, Timer, Sunrise, FlaskConical } from "lucide-react-native";

import { ALARM_PREVIEW_STATE, ALARM_TYPE, type AlarmPreviewState } from "@/constants/Alarm";
import { E2E_ID } from "@/constants/E2E";
import { PlatformType } from "@/enums/app";
import { useAlarmOn } from "@/hooks/useAlarmOn";
import { useAlarmTypeSettings } from "@/hooks/useAlarmTypeSettings";
import { useHaptic } from "@/hooks/useHaptic";
import { canTurnOnAlarm } from "@/utils/alarmReadiness";
import { schedulePreviewAlarm } from "@/utils/alarmScheduler";
import { toScheduledAlarmType } from "@/utils/alarmTypes";

type SettingsSectionProps = {
  title: string;
  icon: React.ComponentType<any>;
  children: React.ReactNode;
};

const SettingsSection = ({ title, icon, children }: SettingsSectionProps) => (
  <Card marginHorizontal="$4" marginBottom="$4" borderRadius="$8">
    <VStack gap="$3">
      <HStack alignItems="center" gap="$2">
        <Box
          width={32}
          height={32}
          borderRadius="$4"
          backgroundColor="$surfaceActive"
          alignItems="center"
          justifyContent="center">
          <Icon as={icon} size="md" color="$typography" />
        </Box>
        <Text size="md" fontWeight="600" color="$typography">
          {title}
        </Text>
      </HStack>
      {children}
    </VStack>
  </Card>
);

const AlarmTypeSettingsScreen = () => {
  const { t } = useTranslation();
  const { type } = useLocalSearchParams<{ type: string }>();
  const alarmType = type === ALARM_TYPE.FAJR ? ALARM_TYPE.FAJR : ALARM_TYPE.FRIDAY;
  // Previews fire by scheduled type ("jummah"), not the settings key ("friday").
  const scheduledType = toScheduledAlarmType(alarmType);
  const hapticSelection = useHaptic("selection");

  const { settings, update, setEnabled } = useAlarmTypeSettings(alarmType);
  const shownOn = useAlarmOn(alarmType);

  const PREVIEW_ALARM_SECONDS = 30;
  const [previewState, setPreviewState] = useState<AlarmPreviewState>(ALARM_PREVIEW_STATE.IDLE);
  // Seconds left in the pending window, ticked down live for the button label.
  const [previewRemaining, setPreviewRemaining] = useState(PREVIEW_ALARM_SECONDS);
  const previewIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const previewFailTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPreviewTimers = () => {
    if (previewIntervalRef.current) clearInterval(previewIntervalRef.current);
    if (previewFailTimerRef.current) clearTimeout(previewFailTimerRef.current);
  };

  useEffect(() => clearPreviewTimers, []);

  const handlePreviewAlarm = async () => {
    if (previewState === ALARM_PREVIEW_STATE.PENDING) return;
    hapticSelection();
    clearPreviewTimers();

    const id = await schedulePreviewAlarm(scheduledType, PREVIEW_ALARM_SECONDS);
    if (id) {
      setPreviewState(ALARM_PREVIEW_STATE.PENDING);
      setPreviewRemaining(PREVIEW_ALARM_SECONDS);
      const startedAt = Date.now();
      previewIntervalRef.current = setInterval(() => {
        const left = Math.round(PREVIEW_ALARM_SECONDS - (Date.now() - startedAt) / 1000);
        if (left <= 0) {
          clearPreviewTimers();
          setPreviewState(ALARM_PREVIEW_STATE.IDLE);
        } else {
          setPreviewRemaining(left);
        }
      }, 1000);
    } else {
      setPreviewState(ALARM_PREVIEW_STATE.FAILED);
      previewFailTimerRef.current = setTimeout(
        () => setPreviewState(ALARM_PREVIEW_STATE.IDLE),
        3000
      );
    }
  };

  // One readiness check at a time, so a quick second flip opens no second gate.
  const checking = useRef(false);

  const handleEnabledToggle = async (enabled: boolean) => {
    if (checking.current) return;
    hapticSelection();
    if (enabled) {
      checking.current = true;
      // Never rejects: a failed read is a no.
      const ready = await canTurnOnAlarm();
      checking.current = false;
      // The gate shows what is missing: the city first, then the permissions.
      if (!ready) {
        router.push(BACK_DESTINATION.SETTINGS_ALARM.href);
        return;
      }
    }
    await setEnabled(enabled);
  };

  const title =
    alarmType === ALARM_TYPE.FAJR ? t("alarm.settings.fajrAlarm") : t("alarm.settings.fridayAlarm");

  return (
    <Background>
      <ScreenHeader title={title} back={{ fallback: BACK_DESTINATION.SETTINGS_ALARM }} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}>
        <VStack flex={1} paddingTop="$4">
          {/* Enable Toggle */}
          <Card marginHorizontal="$4" marginBottom="$4" borderRadius="$8">
            <HStack justifyContent="space-between" alignItems="center">
              <VStack flex={1} marginEnd="$4">
                <Text size="lg" fontWeight="600" color="$typography">
                  {t("alarm.settings.enableAlarm")}
                </Text>
                <Text size="sm" color="$typographySecondary">
                  {alarmType === ALARM_TYPE.FAJR
                    ? t("alarm.settings.fajrEnableDescription")
                    : t("alarm.settings.fridayEnableDescription")}
                </Text>
              </VStack>
              <Switch
                testID={E2E_ID.ALARM_ENABLE_SWITCH}
                value={shownOn}
                onValueChange={(enabled) => void handleEnabledToggle(enabled)}
                size="md"
                accessibilityLabel={t("alarm.settings.enableAlarm")}
              />
            </HStack>
          </Card>

          {shownOn && (
            <>
              {/* Timing Settings */}
              <SettingsSection title={t("alarm.settings.timing")} icon={Timer}>
                <Text size="sm" color="$typographySecondary" marginBottom="$2">
                  {alarmType === ALARM_TYPE.FAJR
                    ? t("alarm.settings.timingDescriptionFajr")
                    : t("alarm.settings.timingDescriptionFriday")}
                </Text>
                <TimingSettings
                  value={settings.timing}
                  alarmType={alarmType}
                  onChange={(timing) => update({ timing })}
                />
              </SettingsSection>

              {/* Sound Settings */}
              <SettingsSection title={t("alarm.settings.sound")} icon={Volume2}>
                <SoundPicker value={settings.sound} onChange={(sound) => update({ sound })} />

                <VStack
                  gap="$2"
                  marginTop="$3"
                  paddingTop="$3"
                  borderTopWidth={1}
                  borderColor="$outlineSecondary">
                  <Text size="sm" color="$typographySecondary">
                    {t("alarm.settings.volume")}
                  </Text>
                  <VolumeSlider value={settings.volume} onChange={(volume) => update({ volume })} />
                </VStack>
              </SettingsSection>

              {/* Gentle Wake-Up Settings (Android-only: iOS alarm sound is OS-controlled) */}
              {Platform.OS === PlatformType.ANDROID && (
                <SettingsSection title={t("alarm.settings.gentleWakeUp")} icon={Sunrise}>
                  <Text size="sm" color="$typographySecondary" marginBottom="$2">
                    {t("alarm.settings.gentleWakeUpDescription")}
                  </Text>
                  <GentleWakeUpSettings
                    value={settings.gentleWakeUp}
                    onChange={(gentleWakeUp) => update({ gentleWakeUp })}
                  />
                </SettingsSection>
              )}

              {/* Challenge Settings */}
              <SettingsSection title={t("alarm.settings.challenge")} icon={Brain}>
                <Text size="sm" color="$typographySecondary" marginBottom="$2">
                  {t("alarm.settings.challengeDescription")}
                </Text>
                <ChallengePicker
                  value={settings.challenge}
                  onChange={(challenge) => update({ challenge })}
                />
              </SettingsSection>

              {/* Vibration Settings */}
              <SettingsSection title={t("alarm.settings.vibration")} icon={Vibrate}>
                <VibrationSettings
                  value={settings.vibration}
                  onChange={(vibration) => update({ vibration })}
                />
              </SettingsSection>

              {/* Snooze Settings */}
              <SettingsSection title={t("alarm.settings.snooze")} icon={Clock}>
                <SnoozeSettings value={settings.snooze} onChange={(snooze) => update({ snooze })} />
              </SettingsSection>

              {/* Preview Alarm: end-to-end rehearsal using the saved per-type settings */}
              <SettingsSection title={t("alarm.settings.previewAlarm")} icon={FlaskConical}>
                <Text size="sm" color="$typographySecondary" marginBottom="$2">
                  {t("alarm.settings.previewAlarmHint")}
                </Text>
                <Button
                  size="lg"
                  minHeight={44}
                  action={previewState === ALARM_PREVIEW_STATE.FAILED ? "negative" : "primary"}
                  variant={previewState === ALARM_PREVIEW_STATE.IDLE ? "solid" : "outline"}
                  disabled={previewState === ALARM_PREVIEW_STATE.PENDING}
                  onPress={handlePreviewAlarm}
                  accessibilityRole="button"
                  accessibilityLabel={t("a11y.alarm.previewAlarm", {
                    seconds: PREVIEW_ALARM_SECONDS,
                  })}
                  accessibilityState={{ disabled: previewState === ALARM_PREVIEW_STATE.PENDING }}>
                  <Button.Text>
                    {previewState === ALARM_PREVIEW_STATE.PENDING
                      ? t("alarm.settings.previewAlarmPending", { seconds: previewRemaining })
                      : previewState === ALARM_PREVIEW_STATE.FAILED
                        ? t("alarm.settings.previewAlarmFailed")
                        : t("alarm.settings.previewAlarm")}
                  </Button.Text>
                </Button>
              </SettingsSection>
            </>
          )}
        </VStack>
      </ScrollView>
    </Background>
  );
};

export default AlarmTypeSettingsScreen;
