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

  return (
    <VStack space="sm">
      <HStack className="justify-between items-center">
        <Text className="text-sm text-typography">{t("common.enabled")}</Text>
        <Switch value={value.enabled} onValueChange={handleToggle} size="sm" />
      </HStack>

      {value.enabled && (
        <HStack className="justify-between items-center">
          <Text className="text-sm text-typography-secondary">{t("alarm.settings.duration")}</Text>
          <Select
            initialLabel={t("common.minute", { count: value.durationMinutes })}
            selectedValue={String(value.durationMinutes)}
            onValueChange={handleDurationChange}>
            <SelectTrigger
              variant="outline"
              size="md"
              className="w-28 h-10 rounded-lg bg-background-primary">
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
                  {GENTLE_WAKEUP_DURATIONS.map((duration) => (
                    <SelectItem
                      key={duration}
                      label={t("common.minute", { count: duration })}
                      value={String(duration)}
                      className={`px-4 py-3 mb-2 rounded-lg ${
                        value.durationMinutes === duration
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

export default GentleWakeUpSettings;
