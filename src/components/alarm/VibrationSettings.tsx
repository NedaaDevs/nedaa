import { FC } from "react";
import { useTranslation } from "react-i18next";

import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectTrigger,
  SelectInput,
  SelectIcon,
  SelectPortal,
  SelectBackdrop,
  SelectContent,
  SelectDragIndicatorWrapper,
  SelectDragIndicator,
  SelectItem,
  SelectScrollView,
} from "@/components/ui/select";

import { ChevronDown } from "lucide-react-native";

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

  return (
    <VStack space="sm">
      <HStack className="justify-between items-center">
        <Text className="text-sm text-typography">{t("common.enabled")}</Text>
        <Switch value={value.enabled} onValueChange={handleToggle} size="sm" />
      </HStack>

      {value.enabled && (
        <HStack className="justify-between items-center">
          <Text className="text-sm text-typography-secondary">{t("alarm.settings.pattern")}</Text>
          <Select
            initialLabel={t(VIBRATION_PATTERNS.find((p) => p.value === value.pattern)?.label || "")}
            selectedValue={value.pattern}
            onValueChange={handlePatternChange}>
            <SelectTrigger
              variant="outline"
              size="md"
              className="w-32 h-10 rounded-lg bg-background-primary">
              <SelectInput className="text-left !text-typography font-medium text-sm" />
              <SelectIcon className="mr-2" as={ChevronDown} />
            </SelectTrigger>

            <SelectPortal>
              <SelectBackdrop />
              <SelectContent className="bg-background-secondary rounded-xl shadow-xl mx-4">
                <SelectDragIndicatorWrapper>
                  <SelectDragIndicator />
                </SelectDragIndicatorWrapper>

                <SelectScrollView className="px-2 pt-1 pb-4">
                  {VIBRATION_PATTERNS.map((option) => (
                    <SelectItem
                      key={option.value}
                      label={t(option.label)}
                      value={option.value}
                      className={`px-4 py-3 mb-2 rounded-lg ${
                        value.pattern === option.value
                          ? "bg-surface-active"
                          : "bg-background-primary"
                      }`}
                    />
                  ))}
                </SelectScrollView>
              </SelectContent>
            </SelectPortal>
          </Select>
        </HStack>
      )}
    </VStack>
  );
};

export default VibrationSettings;
