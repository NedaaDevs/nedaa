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
      return `${t("common.hour", { count: hours })} ${t("common.minute", { count: mins })}`;
    }
    return t("common.minute", { count: minutes });
  };

  return (
    <VStack gap="$3">
      {showAtPrayerTimeOption && (
        <HStack gap="$2">
          <Pressable
            flex={1}
            padding="$3"
            borderRadius="$4"
            borderWidth={1}
            backgroundColor={
              timing.mode === "atPrayerTime" ? "$surfaceActive" : "$backgroundPrimary"
            }
            borderColor={timing.mode === "atPrayerTime" ? "$primary" : "$outlineSecondary"}
            onPress={() => handleModeChange("atPrayerTime")}>
            <Text
              size="sm"
              textAlign="center"
              fontWeight="500"
              color={timing.mode === "atPrayerTime" ? "$typography" : "$typographySecondary"}>
              {t("alarm.settings.atPrayerTime")}
            </Text>
          </Pressable>

          <Pressable
            flex={1}
            padding="$3"
            borderRadius="$4"
            borderWidth={1}
            backgroundColor={
              timing.mode === "beforePrayerTime" ? "$surfaceActive" : "$backgroundPrimary"
            }
            borderColor={timing.mode === "beforePrayerTime" ? "$primary" : "$outlineSecondary"}
            onPress={() => handleModeChange("beforePrayerTime")}>
            <Text
              size="sm"
              textAlign="center"
              fontWeight="500"
              color={timing.mode === "beforePrayerTime" ? "$typography" : "$typographySecondary"}>
              {t("alarm.settings.beforePrayerTime")}
            </Text>
          </Pressable>
        </HStack>
      )}

      {(timing.mode === "beforePrayerTime" || !showAtPrayerTimeOption) && (
        <VStack gap="$2">
          <HStack justifyContent="space-between" alignItems="center">
            <Text textAlign="left" size="sm" color="$typographySecondary">
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
              {minuteSteps
                .filter((m) => (alarmType === "fajr" ? m > 0 : true))
                .map((minutes) => (
                  <Pressable
                    key={minutes}
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
