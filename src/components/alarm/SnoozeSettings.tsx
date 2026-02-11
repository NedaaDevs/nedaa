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

  return (
    <VStack space="sm">
      <HStack className="justify-between items-center">
        <Text className="text-left text-sm text-typography">{t("common.enabled")}</Text>
        <Switch value={value.enabled} onValueChange={handleToggle} size="sm" />
      </HStack>

      {value.enabled && (
        <VStack space="sm">
          <HStack className="justify-between items-center">
            <Text className="text-left text-sm text-typography-secondary">
              {t("alarm.settings.maxSnoozes")}
            </Text>
            <Select
              initialLabel={String(value.maxCount)}
              selectedValue={String(value.maxCount)}
              onValueChange={handleMaxCountChange}>
              <SelectTrigger
                variant="outline"
                size="md"
                className="w-24 h-10 rounded-lg bg-background-primary">
                <SelectInput className="text-left !text-typography font-medium text-sm" />
                <SelectIcon className="me-2" as={ChevronDown} />
              </SelectTrigger>

              <SelectPortal>
                <SelectBackdrop />
                <SelectContent className="bg-background-secondary rounded-xl shadow-xl mx-4">
                  <SelectDragIndicatorWrapper>
                    <SelectDragIndicator />
                  </SelectDragIndicatorWrapper>

                  <SelectScrollView className="px-2 pt-1 pb-4">
                    {SNOOZE_MAX_COUNTS.map((count) => (
                      <SelectItem
                        key={count}
                        label={String(count)}
                        value={String(count)}
                        className={`px-4 py-3 mb-2 rounded-lg ${
                          value.maxCount === count ? "bg-surface-active" : "bg-background-primary"
                        }`}
                      />
                    ))}
                  </SelectScrollView>
                </SelectContent>
              </SelectPortal>
            </Select>
          </HStack>

          <HStack className="justify-between items-center">
            <Text className="text-left text-sm text-typography-secondary">
              {t("alarm.settings.snoozeDuration")}
            </Text>
            <Select
              initialLabel={t("common.minute", { count: value.durationMinutes })}
              selectedValue={String(value.durationMinutes)}
              onValueChange={handleDurationChange}>
              <SelectTrigger
                variant="outline"
                size="md"
                className="w-32 h-10 rounded-lg bg-background-primary">
                <SelectInput className="text-left !text-typography font-medium text-sm" />
                <SelectIcon className="me-2" as={ChevronDown} />
              </SelectTrigger>

              <SelectPortal>
                <SelectBackdrop />
                <SelectContent className="bg-background-secondary rounded-xl shadow-xl mx-4">
                  <SelectDragIndicatorWrapper>
                    <SelectDragIndicator />
                  </SelectDragIndicatorWrapper>

                  <SelectScrollView className="px-2 pt-1 pb-4">
                    {SNOOZE_DURATIONS.map((duration) => (
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
        </VStack>
      )}
    </VStack>
  );
};

export default SnoozeSettings;
