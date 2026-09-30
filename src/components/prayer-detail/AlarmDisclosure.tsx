import { useState } from "react";
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
} from "@/constants/Alarm";
import type { PrayerId } from "@/constants/Prayer";
import { useAlarmTypeSettings } from "@/hooks/useAlarmTypeSettings";
import { useShownDay } from "@/hooks/useShownDay";
import { useAlarmSettingsStore } from "@/stores/alarmSettings";
import { useCustomSoundsStore } from "@/stores/customSounds";
import type { AlarmType, TimingConfig, TimingMode } from "@/types/alarm";
import { alarmTypeForPrayer } from "@/utils/alarmTypes";
import { getAlarmSoundChoiceGroups } from "@/utils/sound";

const TITLE = {
  [ALARM_TYPE.FAJR]: "alarm.settings.fajrAlarm",
  [ALARM_TYPE.FRIDAY]: "alarm.settings.fridayAlarm",
} as const satisfies Record<AlarmType, string>;

const SETTINGS_TITLE = {
  [ALARM_TYPE.FAJR]: "alarm.settings.fajrAlarm",
  [ALARM_TYPE.FRIDAY]: "alarm.settings.fridayAlarm",
} as const satisfies Record<AlarmType, string>;

const MODE_LABEL = {
  [ALARM_TIMING_MODE.AT_PRAYER_TIME]: "prayerDetail.alarm.mode.atPrayer",
  [ALARM_TIMING_MODE.BEFORE_PRAYER_TIME]: "prayerDetail.alarm.mode.before",
} as const satisfies Record<TimingMode, string>;

/** The alarm this prayer offers on the shown day, or null for none. */
export const useAlarmTypeFor = (prayerId: PrayerId): AlarmType | null => {
  const { day } = useShownDay();
  return day ? alarmTypeForPrayer(prayerId, day) : null;
};

const timingSummary = (type: AlarmType, timing: TimingConfig, t: TFunction) => {
  if (type === ALARM_TYPE.FRIDAY) {
    return t("prayerDetail.alarm.summary.fridayBefore", { count: timing.minutesBefore });
  }
  return timing.mode === ALARM_TIMING_MODE.AT_PRAYER_TIME
    ? t("prayerDetail.alarm.summary.atPrayer")
    : t("prayerDetail.alarm.summary.before", { count: timing.minutesBefore });
};

const AlarmPanel = ({ type }: { type: AlarmType }) => {
  const { t } = useTranslation();
  const { settings, update, setEnabled } = useAlarmTypeSettings(type);
  const customSounds = useCustomSoundsStore((state) => state.customSounds);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  const { modes, minuteSteps } = ALARM_TIMING_CHOICES[type];
  // A zero offset is the at-prayer mode, not a step.
  const beforeSteps = minuteSteps.filter((minutes) => minutes > 0);
  const { timing } = settings;

  // The store turns the alarm on before scheduling and back off if that fails.
  const toggle = (enabled: boolean) => {
    if (pending) return;
    setFailed(false);
    setPending(true);
    const settle = () => {
      setPending(false);
      setFailed(enabled && !useAlarmSettingsStore.getState()[type].enabled);
    };
    setEnabled(enabled).then(settle, settle);
  };

  const chooseMode = (mode: TimingMode) =>
    update({
      timing: {
        mode,
        minutesBefore: mode === ALARM_TIMING_MODE.AT_PRAYER_TIME ? 0 : (beforeSteps[0] ?? 0),
      },
    });

  const summary = pending
    ? t("prayerDetail.alarm.summary.pending")
    : failed
      ? t("prayerDetail.alarm.summary.failed")
      : !settings.enabled
        ? t(type === ALARM_TYPE.FRIDAY ? "alarm.settings.fridayEnableDescription" : "common.off")
        : timingSummary(type, timing, t);

  const settingsName = t(SETTINGS_TITLE[type]);

  return (
    <SwitchGroup
      icon={AlarmClock}
      label={t(TITLE[type])}
      summary={summary}
      value={settings.enabled}
      onValueChange={toggle}>
      {modes.length > 1 ? (
        <SegmentedChoice
          options={modes}
          value={timing.mode}
          onChange={chooseMode}
          accessibilityLabel={t("prayerDetail.alarm.timing")}
          label={(mode) => t(MODE_LABEL[mode])}
        />
      ) : null}
      {timing.mode === ALARM_TIMING_MODE.BEFORE_PRAYER_TIME ? (
        <VStack gap="$tight">
          <Text size="xs" color="$muted">
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
        hint={t("a11y.prayerDetail.alarm.moreHint", { name: settingsName })}
        onPress={() => router.push(alarmSettingsHref(type))}
      />
    </SwitchGroup>
  );
};

/** The prayer's reliable alarm: on or off, when it rings, and its sound. */
export const AlarmDisclosure = ({ prayerId }: { prayerId: PrayerId }) => {
  const type = useAlarmTypeFor(prayerId);
  return type ? <AlarmPanel type={type} /> : null;
};
