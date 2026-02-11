import { FC } from "react";
import { useTranslation } from "react-i18next";

import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { Pressable } from "@/components/ui/pressable";
import { Box } from "@/components/ui/box";
import { Icon } from "@/components/ui/icon";

import { Minus, Plus } from "lucide-react-native";

import { TimingConfig, TimingMode, AlarmType } from "@/types/alarm";
import { useHaptic } from "@/hooks/useHaptic";

type Props = {
  value: TimingConfig;
  alarmType: AlarmType;
  onChange: (config: TimingConfig) => void;
};

const FAJR_MINUTE_STEPS = [0, 5, 10, 15, 20, 30, 45, 60, 90];
const FRIDAY_MINUTE_STEPS = [15, 30, 45, 60, 90, 120];

const DEFAULT_TIMING: TimingConfig = { mode: "atPrayerTime", minutesBefore: 0 };

const TimingSettings: FC<Props> = ({ value, alarmType, onChange }) => {
  const { t } = useTranslation();
  const hapticSelection = useHaptic("selection");
  const hapticLight = useHaptic("light");

  // Ensure value has defaults if undefined
  const timing = value ?? DEFAULT_TIMING;

  const showAtPrayerTimeOption = alarmType === "fajr";
  const minuteSteps = alarmType === "fajr" ? FAJR_MINUTE_STEPS : FRIDAY_MINUTE_STEPS;

  const handleModeChange = (mode: TimingMode) => {
    hapticSelection();
    onChange({
      mode,
      minutesBefore: mode === "atPrayerTime" ? 0 : timing.minutesBefore || 15,
    });
  };

  const handleDecrease = () => {
    hapticLight();
    const currentIndex = minuteSteps.findIndex((m) => m >= (timing.minutesBefore || 0));
    const newIndex = Math.max(0, currentIndex - 1);
    onChange({ ...timing, minutesBefore: minuteSteps[newIndex] });
  };

  const handleIncrease = () => {
    hapticLight();
    const currentIndex = minuteSteps.findIndex((m) => m >= (timing.minutesBefore || 0));
    const newIndex = Math.min(minuteSteps.length - 1, currentIndex + 1);
    onChange({ ...timing, minutesBefore: minuteSteps[newIndex] });
  };

  const handleStepPress = (minutes: number) => {
    hapticLight();
    onChange({ ...timing, minutesBefore: minutes });
  };

  const formatMinutes = (minutes: number) => {
    if (minutes === 0) return t("alarm.settings.atPrayerTime");
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      if (mins === 0) {
        return t("common.hour", { count: hours });
      }
      return `${hours}h ${mins}m`;
    }
    return t("common.minute", { count: minutes });
  };

  return (
    <VStack space="md">
      {showAtPrayerTimeOption && (
        <HStack space="sm">
          <Pressable
            className={`flex-1 p-3 rounded-lg border ${
              timing.mode === "atPrayerTime"
                ? "bg-surface-active border-primary-400"
                : "bg-background-primary border-outline-secondary"
            }`}
            onPress={() => handleModeChange("atPrayerTime")}>
            <Text
              className={`text-sm text-center font-medium ${
                timing.mode === "atPrayerTime" ? "text-typography" : "text-typography-secondary"
              }`}>
              {t("alarm.settings.atPrayerTime")}
            </Text>
          </Pressable>

          <Pressable
            className={`flex-1 p-3 rounded-lg border ${
              timing.mode === "beforePrayerTime"
                ? "bg-surface-active border-primary-400"
                : "bg-background-primary border-outline-secondary"
            }`}
            onPress={() => handleModeChange("beforePrayerTime")}>
            <Text
              className={`text-sm text-center font-medium ${
                timing.mode === "beforePrayerTime" ? "text-typography" : "text-typography-secondary"
              }`}>
              {t("alarm.settings.beforePrayerTime")}
            </Text>
          </Pressable>
        </HStack>
      )}

      {(timing.mode === "beforePrayerTime" || !showAtPrayerTimeOption) && (
        <VStack space="sm">
          <HStack className="justify-between items-center">
            <Text className="text-left text-sm text-typography-secondary">
              {t("alarm.settings.minutesBefore")}
            </Text>
            <Box className="bg-surface-active px-3 py-1 rounded-lg">
              <Text className="text-sm font-semibold text-typography">
                {formatMinutes(timing.minutesBefore || minuteSteps[0])}
              </Text>
            </Box>
          </HStack>

          <HStack space="sm" className="items-center">
            <Pressable
              onPress={handleDecrease}
              className="w-10 h-10 rounded-full bg-background-muted items-center justify-center">
              <Icon as={Minus} size="md" className="text-typography" />
            </Pressable>

            <HStack space="xs" className="flex-1 justify-center flex-wrap">
              {minuteSteps
                .filter((m) => (alarmType === "fajr" ? m > 0 : true))
                .map((minutes) => (
                  <Pressable
                    key={minutes}
                    onPress={() => handleStepPress(minutes)}
                    className="px-1 py-1">
                    <Box
                      className={`w-3 h-3 rounded-full ${
                        (timing.minutesBefore || 0) >= minutes
                          ? "bg-accent-primary"
                          : "bg-background-muted"
                      }`}
                    />
                  </Pressable>
                ))}
            </HStack>

            <Pressable
              onPress={handleIncrease}
              className="w-10 h-10 rounded-full bg-background-muted items-center justify-center">
              <Icon as={Plus} size="md" className="text-typography" />
            </Pressable>
          </HStack>
        </VStack>
      )}
    </VStack>
  );
};

export default TimingSettings;
