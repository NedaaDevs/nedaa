import { FC } from "react";
import type { ParseKeys } from "i18next";
import { useTranslation } from "react-i18next";

import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { Pressable } from "@/components/ui/pressable";
import { Box } from "@/components/ui/box";
import { Icon } from "@/components/ui/icon";

import { Minus, Plus } from "lucide-react-native";

import { TimingConfig, TimingMode, AlarmType, DEFAULT_TIMING_CONFIG } from "@/types/alarm";
import { useHaptic } from "@/hooks/useHaptic";
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
  const hapticSelection = useHaptic("selection");
  const hapticLight = useHaptic("light");

  const timing = value ?? DEFAULT_TIMING_CONFIG;

  const { modes, minuteSteps } = ALARM_TIMING_CHOICES[alarmType];
  const offersModeChoice = modes.length > 1;

  const handleModeChange = (mode: TimingMode) => {
    hapticSelection();
    onChange(timingForMode(alarmType, mode));
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
      return `${t("common.hour", { count: hours })} ${t("common.minute", { count: mins })}`;
    }
    return t("common.minute", { count: minutes });
  };

  return (
    <VStack gap="$3">
      {offersModeChoice && (
        <HStack gap="$2">
          {modes.map((mode) => {
            const selected = timing.mode === mode;
            return (
              <Pressable
                key={mode}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={t(MODE_LABEL[mode])}
                flex={1}
                padding="$3"
                borderRadius="$4"
                borderWidth={1}
                backgroundColor={selected ? "$surfaceActive" : "$backgroundPrimary"}
                borderColor={selected ? "$primary" : "$outlineSecondary"}
                onPress={() => handleModeChange(mode)}>
                <Text
                  size="sm"
                  textAlign="center"
                  fontWeight="500"
                  color={selected ? "$typography" : "$typographySecondary"}>
                  {t(MODE_LABEL[mode])}
                </Text>
              </Pressable>
            );
          })}
        </HStack>
      )}

      {(timing.mode === ALARM_TIMING_MODE.BEFORE_PRAYER_TIME || !offersModeChoice) && (
        <VStack gap="$2">
          <HStack justifyContent="space-between" alignItems="center">
            <Text size="sm" color="$typographySecondary">
              {t("alarm.settings.minutesBefore")}
            </Text>
            <Box
              backgroundColor="$surfaceActive"
              paddingHorizontal="$3"
              paddingVertical="$1"
              borderRadius="$4">
              <Text size="sm" fontWeight="600" color="$typography">
                {formatMinutes(timing.minutesBefore || minuteSteps[0])}
              </Text>
            </Box>
          </HStack>

          <HStack gap="$2" alignItems="center">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("a11y.alarm.decreaseMinutes")}
              onPress={handleDecrease}
              width={44}
              height={44}
              borderRadius={999}
              backgroundColor="$backgroundMuted"
              alignItems="center"
              justifyContent="center">
              <Icon as={Minus} size="md" color="$typography" />
            </Pressable>

            <HStack gap="$1" flex={1} justifyContent="center" flexWrap="wrap">
              {/* A zero offset is the at-prayer mode, not a step. */}
              {minuteSteps
                .filter((m) => m > 0)
                .map((minutes) => (
                  <Pressable
                    key={minutes}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: (timing.minutesBefore || 0) >= minutes }}
                    accessibilityLabel={`${minutes} ${t("common.minute", { count: minutes })}`}
                    onPress={() => handleStepPress(minutes)}
                    minWidth={28}
                    minHeight={28}
                    alignItems="center"
                    justifyContent="center">
                    <Box
                      width={12}
                      height={12}
                      borderRadius={999}
                      backgroundColor={
                        (timing.minutesBefore || 0) >= minutes
                          ? "$accentPrimary"
                          : "$backgroundMuted"
                      }
                    />
                  </Pressable>
                ))}
            </HStack>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("a11y.alarm.increaseMinutes")}
              onPress={handleIncrease}
              width={44}
              height={44}
              borderRadius={999}
              backgroundColor="$backgroundMuted"
              alignItems="center"
              justifyContent="center">
              <Icon as={Plus} size="md" color="$typography" />
            </Pressable>
          </HStack>
        </VStack>
      )}
    </VStack>
  );
};

export default TimingSettings;
