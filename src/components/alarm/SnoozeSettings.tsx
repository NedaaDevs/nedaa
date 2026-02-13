import { FC, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { Switch } from "@/components/ui/switch";
import { Select } from "@/components/ui/select";

import {
  SnoozeConfig,
  SnoozeDuration,
  SnoozeMaxCount,
  SNOOZE_DURATIONS,
  SNOOZE_MAX_COUNTS,
} from "@/types/alarm";
import { useHaptic } from "@/hooks/useHaptic";

type Props = {
  value: SnoozeConfig;
  onChange: (config: SnoozeConfig) => void;
};

const SnoozeSettings: FC<Props> = ({ value, onChange }) => {
  const { t } = useTranslation();
  const hapticSelection = useHaptic("selection");

  const handleToggle = (enabled: boolean) => {
    hapticSelection();
    onChange({ ...value, enabled });
  };

  const handleMaxCountChange = (count: string) => {
    hapticSelection();
    onChange({ ...value, maxCount: parseInt(count, 10) as SnoozeMaxCount });
  };

  const handleDurationChange = (duration: string) => {
    hapticSelection();
    onChange({ ...value, durationMinutes: parseInt(duration, 10) as SnoozeDuration });
  };

  const maxCountItems = useMemo(
    () => SNOOZE_MAX_COUNTS.map((c) => ({ label: String(c), value: String(c) })),
    []
  );

  const durationItems = useMemo(
    () =>
      SNOOZE_DURATIONS.map((d) => ({
        label: t("common.minute", { count: d }),
        value: String(d),
      })),
    [t]
  );

  return (
    <VStack gap="$2">
      <HStack justifyContent="space-between" alignItems="center">
        <Text size="sm" color="$typography">
          {t("common.enabled")}
        </Text>
        <Switch value={value.enabled} onValueChange={handleToggle} size="sm" />
      </HStack>

      {value.enabled && (
        <VStack gap="$2">
          <HStack justifyContent="space-between" alignItems="center">
            <Text size="sm" color="$typographySecondary" flex={1}>
              {t("alarm.settings.maxSnoozes")}
            </Text>
            <Select
              selectedValue={String(value.maxCount)}
              onValueChange={handleMaxCountChange}
              items={maxCountItems}
              placeholder={t("alarm.settings.maxSnoozes")}
            />
          </HStack>

          <HStack justifyContent="space-between" alignItems="center">
            <Text size="sm" color="$typographySecondary" flex={1}>
              {t("alarm.settings.snoozeDuration")}
            </Text>
            <Select
              selectedValue={String(value.durationMinutes)}
              onValueChange={handleDurationChange}
              items={durationItems}
              placeholder={t("alarm.settings.snoozeDuration")}
            />
          </HStack>
        </VStack>
      )}
    </VStack>
  );
};

export default SnoozeSettings;
