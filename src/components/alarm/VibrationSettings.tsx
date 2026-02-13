import { FC, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { Switch } from "@/components/ui/switch";
import { Select } from "@/components/ui/select";

import { VibrationConfig, VibrationPattern } from "@/types/alarm";
import { useHaptic } from "@/hooks/useHaptic";

type Props = {
  value: VibrationConfig;
  onChange: (config: VibrationConfig) => void;
};

const VIBRATION_PATTERNS: { value: VibrationPattern; label: string }[] = [
  { value: "default", label: "alarm.vibration.default" },
  { value: "gentle", label: "alarm.vibration.gentle" },
  { value: "aggressive", label: "alarm.vibration.aggressive" },
];

const VibrationSettings: FC<Props> = ({ value, onChange }) => {
  const { t } = useTranslation();
  const hapticSelection = useHaptic("selection");

  const handleToggle = (enabled: boolean) => {
    hapticSelection();
    onChange({ ...value, enabled });
  };

  const handlePatternChange = (pattern: string) => {
    hapticSelection();
    onChange({ ...value, pattern: pattern as VibrationPattern });
  };

  const patternItems = useMemo(
    () => VIBRATION_PATTERNS.map((p) => ({ label: t(p.label), value: p.value })),
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
        <VStack gap="$0.5">
          <Text size="sm" color="$typographySecondary">
            {t("alarm.settings.pattern")}
          </Text>
          <Select
            selectedValue={value.pattern}
            onValueChange={handlePatternChange}
            items={patternItems}
            placeholder={t("alarm.settings.pattern")}
          />
        </VStack>
      )}
    </VStack>
  );
};

export default VibrationSettings;
