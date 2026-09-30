import { useState } from "react";
import { AccessibilityInfo } from "react-native";
import { useTranslation } from "react-i18next";
import { router } from "expo-router";
import type { TFunction } from "i18next";
import { AlarmClock, SlidersHorizontal } from "lucide-react-native";

import { ListRow } from "@/components/ui/list-row";
import { SegmentedChoice } from "@/components/ui/segmented-choice";
import { SoundPicker } from "@/components/ui/sound-picker";
import { SwitchGroup } from "@/components/ui/switch-group";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import {
  ALARM_TIMING_CHOICES,
  ALARM_TIMING_MODE,
  ALARM_TYPE,
  alarmSettingsHref,
  timingForMode,
} from "@/constants/Alarm";
import { BACK_DESTINATION } from "@/constants/BackDestinations";
import { useAlarmTypeSettings } from "@/hooks/useAlarmTypeSettings";
import { useAlarmSettingsStore } from "@/stores/alarmSettings";
import { useCustomSoundsStore } from "@/stores/customSounds";
import type { AlarmType, TimingConfig, TimingMode } from "@/types/alarm";
import { alarmPermissionsGranted } from "@/utils/alarmPermissions";
import { getAlarmSoundChoiceGroups } from "@/utils/sound";

const TITLE = {
  [ALARM_TYPE.FAJR]: "alarm.settings.fajrAlarm",
  [ALARM_TYPE.FRIDAY]: "alarm.settings.fridayAlarm",
} as const satisfies Record<AlarmType, string>;

const MODE_LABEL = {
  [ALARM_TIMING_MODE.AT_PRAYER_TIME]: "prayerDetail.alarm.mode.atPrayer",
  [ALARM_TIMING_MODE.BEFORE_PRAYER_TIME]: "prayerDetail.alarm.mode.before",
} as const satisfies Record<TimingMode, string>;

const timingSummary = (type: AlarmType, timing: TimingConfig, t: TFunction) => {
  if (type === ALARM_TYPE.FRIDAY) {
    return t("prayerDetail.alarm.summary.fridayBefore", { count: timing.minutesBefore });
  }
  return timing.mode === ALARM_TIMING_MODE.AT_PRAYER_TIME
    ? t("prayerDetail.alarm.summary.atPrayer")
    : t("prayerDetail.alarm.summary.before", { count: timing.minutesBefore });
};

/** A reliable alarm: on or off, when it rings, and its sound. */
export const AlarmDisclosure = ({ type }: { type: AlarmType }) => {
  const { t } = useTranslation();
  const { settings, update, setEnabled } = useAlarmTypeSettings(type);
  const customSounds = useCustomSoundsStore((state) => state.customSounds);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  const { modes, minuteSteps } = ALARM_TIMING_CHOICES[type];
  // A zero offset is the at-prayer mode, not a step.
  const beforeSteps = minuteSteps.filter((minutes) => minutes > 0);
  const { timing } = settings;

  const toggle = async (enabled: boolean) => {
    setFailed(false);
    setPending(true);
    // On a failed check the schedule runs and reports any failure itself.
    if (enabled && !(await alarmPermissionsGranted().catch(() => true))) {
      setPending(false);
      router.push(BACK_DESTINATION.SETTINGS_ALARM.href);
      return;
    }
    await setEnabled(enabled).catch(() => {});
    setPending(false);
    // The store turns the alarm on before scheduling and back off if that fails.
    const didFail = enabled && !useAlarmSettingsStore.getState()[type].enabled;
    setFailed(didFail);
    if (didFail) AccessibilityInfo.announceForAccessibility(t("prayerDetail.alarm.summary.failed"));
  };

  const summary = pending
    ? t("prayerDetail.alarm.summary.pending")
    : failed
      ? t("prayerDetail.alarm.summary.failed")
      : !settings.enabled
        ? t("common.off")
        : timingSummary(type, timing, t);

  const name = t(TITLE[type]);

  return (
    <SwitchGroup
      icon={AlarmClock}
      label={name}
      summary={summary}
      value={settings.enabled}
      busy={pending}
      onValueChange={(enabled) => void toggle(enabled)}>
      {modes.length > 1 ? (
        <SegmentedChoice
          options={modes}
          value={timing.mode}
          onChange={(mode) => update({ timing: timingForMode(type, mode) })}
          accessibilityLabel={t("prayerDetail.alarm.timing")}
          label={(mode) => t(MODE_LABEL[mode])}
        />
      ) : null}
      {timing.mode === ALARM_TIMING_MODE.BEFORE_PRAYER_TIME ? (
        <VStack gap="$tight">
          {/* The pill group reads this as its name, so readers skip it here. */}
          <Text
            size="xs"
            color="$muted"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants">
            {t("prayerDetail.alarm.minutesBefore")}
          </Text>
          <SegmentedChoice
            options={beforeSteps}
            value={timing.minutesBefore}
            onChange={(minutesBefore) => update({ timing: { ...timing, minutesBefore } })}
            accessibilityLabel={t("prayerDetail.alarm.minutesBefore")}
            label={String}
            spokenLabel={(minutes) => t("common.minute", { count: minutes })}
          />
        </VStack>
      ) : null}
      <SoundPicker
        label={t("prayerDetail.alarm.sound")}
        groups={getAlarmSoundChoiceGroups(customSounds, t, settings.sound)}
        value={settings.sound}
        onChange={(sound) => update({ sound })}
      />
      <ListRow
        icon={SlidersHorizontal}
        title={t("prayerDetail.alarm.more.title")}
        status={t("prayerDetail.alarm.more.status")}
        hint={t("a11y.prayerDetail.alarm.moreHint", { name })}
        onPress={() => router.push(alarmSettingsHref(type))}
      />
    </SwitchGroup>
  );
};
