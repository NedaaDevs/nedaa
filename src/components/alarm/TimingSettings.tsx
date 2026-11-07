import { FC } from "react";
import type { ParseKeys } from "i18next";
import { useTranslation } from "react-i18next";

import { VStack } from "@/components/ui/vstack";
import { Text } from "@/components/ui/text";
import { SEGMENTED_FORM, SegmentedChoice } from "@/components/ui/segmented-choice";

import { TimingConfig, TimingMode, AlarmType, DEFAULT_TIMING_CONFIG } from "@/types/alarm";
import { ALARM_TIMING_CHOICES, ALARM_TIMING_MODE, timingForMode } from "@/constants/Alarm";

type Props = {
  value: TimingConfig;
  alarmType: AlarmType;
  onChange: (config: TimingConfig) => void;
};

const MODE_LABEL: Record<TimingMode, ParseKeys> = {
  [ALARM_TIMING_MODE.AT_PRAYER_TIME]: "alarm.settings.atPrayerTime",
  [ALARM_TIMING_MODE.BEFORE_PRAYER_TIME]: "alarm.settings.beforePrayerTime",
};

const TimingSettings: FC<Props> = ({ value, alarmType, onChange }) => {
  const { t } = useTranslation();

  const timing = value ?? DEFAULT_TIMING_CONFIG;

  const { modes, minuteSteps } = ALARM_TIMING_CHOICES[alarmType];
  const offersModeChoice = modes.length > 1;
  // A zero offset is the at-prayer mode, not a step.
  const beforeSteps = minuteSteps.filter((minutes) => minutes > 0);

  return (
    <VStack gap="$3">
      {offersModeChoice && (
        <SegmentedChoice
          options={modes}
          value={timing.mode}
          onChange={(mode) => onChange(timingForMode(alarmType, mode))}
          accessibilityLabel={t("alarm.settings.timing")}
          label={(mode) => t(MODE_LABEL[mode])}
        />
      )}

      {(timing.mode === ALARM_TIMING_MODE.BEFORE_PRAYER_TIME || !offersModeChoice) && (
        <VStack gap="$2">
          <Text size="sm" color="$typographySecondary">
            {t("alarm.settings.minutesBefore")}
          </Text>
          <SegmentedChoice
            options={beforeSteps}
            value={timing.minutesBefore}
            onChange={(minutesBefore) => onChange({ ...timing, minutesBefore })}
            accessibilityLabel={t("alarm.settings.minutesBefore")}
            label={String}
            spokenLabel={(minutes) => t("common.minute", { count: minutes })}
            form={SEGMENTED_FORM.COMPACT}
          />
        </VStack>
      )}
    </VStack>
  );
};

export default TimingSettings;
