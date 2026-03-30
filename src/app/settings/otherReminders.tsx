import { useMemo } from "react";
import { ScrollView } from "react-native";
import { useTranslation } from "react-i18next";
import { parseISO, addMinutes } from "date-fns";

// Components
import { Box } from "@/components/ui/box";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { Switch } from "@/components/ui/switch";
import { Pressable } from "@/components/ui/pressable";
import { Background } from "@/components/ui/background";
import TopBar from "@/components/TopBar";

// Hooks
import { useNotificationSettings } from "@/hooks/useNotificationSettings";
import { useHaptic } from "@/hooks/useHaptic";

// Stores
import prayerTimesStore from "@/stores/prayerTimes";

// Utils
import { formatNumberToLocale } from "@/utils/number";

// Types
import type { OtherTimingId } from "@/types/notification";

type TimingGroup = {
  titleKey: string;
  descriptionKey?: string;
  items: OtherTimingId[];
};

const TIMING_GROUPS: TimingGroup[] = [
  {
    titleKey: "notification.otherTiming.group.morning",
    descriptionKey: "notification.otherTiming.group.morning.description",
    items: ["ishraq", "duha"],
  },
  {
    titleKey: "notification.otherTiming.group.night",
    descriptionKey: "notification.otherTiming.group.night.description",
    items: ["midnight", "firstthird", "lastthird"],
  },
  {
    titleKey: "notification.otherTiming.group.fasting",
    items: ["imsak"],
  },
];

const ISHRAQ_OFFSET_MINUTES = 15;
const MINUTE_OPTIONS = [0, 15, 30, 45] as const;

const OtherRemindersSettings = () => {
  const { t } = useTranslation();
  const hapticSelection = useHaptic("selection");
  const { otherTimingNotifications, duhaTime, updateOtherTimingNotification, updateDuhaTime } =
    useNotificationSettings();

  // Valid hours within today's Duha window
  const duhaHours = useMemo(() => {
    const today = prayerTimesStore.getState().todayTimings;
    if (!today?.otherTimings.sunrise || !today?.timings.dhuhr) return [];
    const startHour =
      addMinutes(parseISO(today.otherTimings.sunrise), ISHRAQ_OFFSET_MINUTES).getHours() + 1;
    const endHour = parseISO(today.timings.dhuhr).getHours();
    const hours: number[] = [];
    for (let h = startHour; h <= endHour; h++) {
      hours.push(h);
    }
    return hours;
  }, []);

  return (
    <Background>
      <TopBar title="notification.otherReminders" backOnClick />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}>
        <VStack flex={1} gap="$4" paddingTop="$4">
          {TIMING_GROUPS.map((group) => (
            <VStack key={group.titleKey} gap="$2">
              {/* Section Header */}
              <Text
                size="sm"
                fontWeight="600"
                color="$typographySecondary"
                paddingHorizontal="$5"
                textTransform="uppercase">
                {t(group.titleKey)}
              </Text>

              {/* Grouped Card */}
              <Box
                backgroundColor="$backgroundSecondary"
                marginHorizontal="$4"
                borderRadius="$4"
                overflow="hidden">
                {group.items.map((timingId, index) => (
                  <Box key={timingId}>
                    <HStack
                      justifyContent="space-between"
                      alignItems="center"
                      paddingHorizontal="$4"
                      paddingVertical="$3.5"
                      minHeight={52}>
                      <Text size="md" color="$typography">
                        {t(`notification.otherTiming.${timingId}.label`)}
                      </Text>
                      <Switch
                        value={otherTimingNotifications[timingId]}
                        onValueChange={(value: boolean) => {
                          hapticSelection();
                          updateOtherTimingNotification(timingId, value);
                        }}
                        accessibilityLabel={t(`notification.otherTiming.${timingId}.label`)}
                      />
                    </HStack>

                    {/* Duha time selector */}
                    {timingId === "duha" &&
                      otherTimingNotifications.duha &&
                      duhaHours.length > 0 && (
                        <>
                          <Box height={0.5} backgroundColor="$outline" marginStart="$4" />
                          <VStack paddingHorizontal="$4" paddingVertical="$3" gap="$3">
                            {/* Hour row — horizontally scrollable */}
                            <VStack gap="$1.5">
                              <HStack justifyContent="space-between" alignItems="center">
                                <Text size="xs" color="$typographySecondary" fontWeight="500">
                                  {t("notification.otherTiming.duha.hourLabel")}
                                </Text>
                                <Text size="xs" color="$typographySecondary" fontWeight="500">
                                  {t("notification.otherTiming.duha.am")}
                                </Text>
                              </HStack>
                              <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={{ gap: 8 }}>
                                {duhaHours.map((hour) => {
                                  const isSelected = duhaTime.hour === hour;
                                  return (
                                    <Pressable
                                      key={hour}
                                      onPress={() => {
                                        hapticSelection();
                                        updateDuhaTime(hour, duhaTime.minute);
                                      }}
                                      accessibilityRole="radio"
                                      accessibilityState={{ selected: isSelected }}
                                      accessibilityLabel={`${hour} ${t("notification.otherTiming.duha.am")}`}
                                      minWidth={44}
                                      minHeight={44}
                                      paddingHorizontal="$3"
                                      borderRadius="$4"
                                      alignItems="center"
                                      justifyContent="center"
                                      backgroundColor={
                                        isSelected ? "$primary" : "$backgroundMuted"
                                      }>
                                      <Text
                                        size="sm"
                                        fontWeight={isSelected ? "600" : "400"}
                                        color={isSelected ? "$typographyContrast" : "$typography"}>
                                        {formatNumberToLocale(`${hour}`)}
                                      </Text>
                                    </Pressable>
                                  );
                                })}
                              </ScrollView>
                            </VStack>

                            {/* Minute row — evenly spaced across full width */}
                            <VStack gap="$1.5">
                              <Text size="xs" color="$typographySecondary" fontWeight="500">
                                {t("notification.otherTiming.duha.minuteLabel")}
                              </Text>
                              <HStack gap="$2" alignItems="center">
                                {MINUTE_OPTIONS.map((minute) => {
                                  const isSelected = duhaTime.minute === minute;
                                  const display = formatNumberToLocale(
                                    `:${String(minute).padStart(2, "0")}`
                                  );
                                  return (
                                    <Pressable
                                      key={minute}
                                      onPress={() => {
                                        hapticSelection();
                                        updateDuhaTime(duhaTime.hour, minute);
                                      }}
                                      accessibilityRole="radio"
                                      accessibilityState={{ selected: isSelected }}
                                      accessibilityLabel={`${String(minute).padStart(2, "0")} ${t("notification.otherTiming.duha.minutes")}`}
                                      flex={1}
                                      minHeight={44}
                                      borderRadius="$4"
                                      alignItems="center"
                                      justifyContent="center"
                                      backgroundColor={
                                        isSelected ? "$primary" : "$backgroundMuted"
                                      }>
                                      <Text
                                        size="sm"
                                        fontWeight={isSelected ? "600" : "400"}
                                        color={isSelected ? "$typographyContrast" : "$typography"}>
                                        {display}
                                      </Text>
                                    </Pressable>
                                  );
                                })}
                              </HStack>
                            </VStack>
                          </VStack>
                        </>
                      )}

                    {/* Separator between items */}
                    {index < group.items.length - 1 && (
                      <Box height={0.5} backgroundColor="$outline" marginStart="$4" />
                    )}
                  </Box>
                ))}
              </Box>

              {/* Section Footer */}
              {group.descriptionKey && (
                <Text size="xs" color="$typographySecondary" paddingHorizontal="$5">
                  {t(group.descriptionKey)}
                </Text>
              )}
            </VStack>
          ))}
        </VStack>
      </ScrollView>
    </Background>
  );
};

export default OtherRemindersSettings;
