import { FC, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { Switch } from "@/components/ui/switch";
import { Select } from "@/components/ui/select";

import { GentleWakeUpConfig, GentleWakeUpDuration, GENTLE_WAKEUP_DURATIONS } from "@/types/alarm";
import { useHaptic } from "@/hooks/useHaptic";

type Props = {
  value: GentleWakeUpConfig;
  onChange: (config: GentleWakeUpConfig) => void;
};

const GentleWakeUpSettings: FC<Props> = ({ value, onChange }) => {
  const { t } = useTranslation();
  const hapticSelection = useHaptic("selection");

  const handleToggle = (enabled: boolean) => {
    hapticSelection();
    onChange({ ...value, enabled });
  };

  const handleDurationChange = (duration: string) => {
    hapticSelection();
    onChange({ ...value, durationMinutes: parseInt(duration, 10) as GentleWakeUpDuration });
  };

  const durationItems = useMemo(
    () =>
      GENTLE_WAKEUP_DURATIONS.map((d) => ({
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
        <HStack justifyContent="space-between" alignItems="center">
          <Text size="sm" color="$typographySecondary" flex={1}>
            {t("alarm.settings.duration")}
          </Text>
          <Select
            selectedValue={String(value.durationMinutes)}
            onValueChange={handleDurationChange}
            items={durationItems}
            placeholder={t("alarm.settings.duration")}
          />
        </HStack>
      )}
    </VStack>
  );
};

export default GentleWakeUpSettings;
