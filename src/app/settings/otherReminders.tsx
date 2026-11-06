import { useMemo } from "react";
import { ScrollView } from "react-native";
import { useTranslation } from "react-i18next";
import { parseISO, addMinutes } from "date-fns";

// Components
import { Box } from "@/components/ui/box";
import { Card } from "@/components/ui/card";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { Switch } from "@/components/ui/switch";
import { Pressable } from "@/components/ui/pressable";
import { Background } from "@/components/ui/background";
import { ScreenHeader } from "@/components/ui/screen-header";

// Hooks
import { useNotificationSettings } from "@/hooks/useNotificationSettings";
import { useHaptic } from "@/hooks/useHaptic";
import { HAPTIC_FEEDBACK } from "@/constants/Haptics";

// Constants
import { MIDNIGHT_MODE } from "@/constants/providers";

// Stores
import { useAppStore } from "@/stores/app";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { usePreferencesStore } from "@/stores/preferences";
import { useProviderSettingsStore } from "@/stores/providerSettings";

// Utils
import { clockPeriod, deviceTimeZone } from "@/utils/date";
import { LTR_ISOLATE } from "@/utils/digits";
import { formatNumberToLocale } from "@/utils/number";
import { spokenClockTime } from "@/utils/spokenClockTime";

// Types
import type { OtherTimingId } from "@/types/notification";
import type { AladhanMidnightModeId } from "@/types/providers/aladhan";

type TimingGroup = {
  titleKey: string;
  /** The footer's key, given the midnight mode that sets the night's span. */
  descriptionKey?: (midnightMode: AladhanMidnightModeId) => string;
  items: OtherTimingId[];
};

const NIGHT_DESCRIPTION_KEY: Record<AladhanMidnightModeId, string> = {
  [MIDNIGHT_MODE.STANDARD]: "notification.otherTiming.group.night.description.standard",
  [MIDNIGHT_MODE.JAFARI]: "notification.otherTiming.group.night.description.jafari",
};

const TIMING_GROUPS: TimingGroup[] = [
  {
    titleKey: "notification.otherTiming.group.morning",
    descriptionKey: () => "notification.otherTiming.group.morning.description",
    items: ["ishraq", "duha"],
  },
  {
    titleKey: "notification.otherTiming.group.night",
    descriptionKey: (midnightMode) => NIGHT_DESCRIPTION_KEY[midnightMode],
    items: ["midnight", "firstthird", "lastthird"],
  },
  {
    titleKey: "notification.otherTiming.group.fasting",
    items: ["imsak"],
  },
];

const ISHRAQ_OFFSET_MINUTES = 15;
const MINUTE_OPTIONS = [0, 15, 30, 45] as const;
const NOON_HOUR = 12;

const OtherRemindersSettings = () => {
  const { t } = useTranslation();
  const hapticSelection = useHaptic(HAPTIC_FEEDBACK.SELECTION);
  const { otherTimingNotifications, duhaTime, updateOtherTimingNotification, updateDuhaTime } =
    useNotificationSettings();

  const locale = useAppStore((state) => state.locale);
  const use24HourTime = usePreferencesStore((state) => state.use24HourTime);
  const western = usePreferencesStore((state) => state.useWesternNumerals);

  // Subscribed rather than read once, because the screen can mount before the
  // day's timings have loaded and the window would stay empty for its lifetime.
  const today = usePrayerTimesStore((state) => state.todayTimings);
  const midnightMode =
    useProviderSettingsStore((state) => state.allSettings[state.currentProviderId]?.midnightMode) ??
    MIDNIGHT_MODE.STANDARD;

  // Valid hours within today's Duha window
  const duhaHours = useMemo(() => {
    if (!today?.otherTimings.sunrise || !today?.timings.dhuhr) return [];
    const startHour =
      addMinutes(parseISO(today.otherTimings.sunrise), ISHRAQ_OFFSET_MINUTES).getHours() + 1;
    const endHour = parseISO(today.timings.dhuhr).getHours();
    const hours: number[] = [];
    for (let h = startHour; h <= endHour; h++) {
      hours.push(h);
    }
    return hours;
  }, [today]);

  const allMorning = !use24HourTime && duhaHours.every((hour) => hour < NOON_HOUR);
  // One caption cannot cover a row that reaches noon, so each hour marks itself.
  const marksEachHour = !use24HourTime && !allMorning;
  // The hours are the device's, so any one day in its zone gives the same words.
  const spokenHour = (hour: number) =>
    spokenClockTime(
      new Date(2000, 0, 1, hour),
      deviceTimeZone(),
      { locale, use24HourTime, western },
      t
    );

  return (
    <Background>
      <ScreenHeader title={t("notification.otherReminders")} back />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}>
        <VStack flex={1} gap="$4" paddingTop="$4">
          {TIMING_GROUPS.map((group) => (
            <VStack key={group.titleKey} gap="$2">
              {/* Section Header */}
              <Text
                accessibilityRole="header"
                size="sm"
                fontWeight="600"
                color="$typographySecondary"
                paddingHorizontal="$5"
                textTransform="uppercase">
                {t(group.titleKey)}
              </Text>

              <Card variant="grouped" marginHorizontal="$4">
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
                                {allMorning ? (
                                  <Text size="xs" color="$typographySecondary" fontWeight="500">
                                    {t("notification.otherTiming.duha.am")}
                                  </Text>
                                ) : null}
                              </HStack>
                              <Box
                                accessibilityRole="radiogroup"
                                accessibilityLabel={t("notification.otherTiming.duha.hourLabel")}>
                                <ScrollView
                                  horizontal
                                  showsHorizontalScrollIndicator={false}
                                  contentContainerStyle={{ gap: 8 }}>
                                  {duhaHours.map((hour) => {
                                    const isSelected = duhaTime.hour === hour;
                                    const ink = isSelected ? "$typographyContrast" : "$typography";
                                    return (
                                      <Pressable
                                        key={hour}
                                        onPress={() => {
                                          hapticSelection();
                                          updateDuhaTime(hour, duhaTime.minute);
                                        }}
                                        accessibilityRole="radio"
                                        accessibilityState={{ selected: isSelected }}
                                        accessibilityLabel={spokenHour(hour)}
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
                                          color={ink}>
                                          {formatNumberToLocale(
                                            `${use24HourTime ? hour : hour % NOON_HOUR || NOON_HOUR}`
                                          )}
                                        </Text>
                                        {marksEachHour ? (
                                          <Text size="xs" color={ink}>
                                            {clockPeriod(hour, locale)}
                                          </Text>
                                        ) : null}
                                      </Pressable>
                                    );
                                  })}
                                </ScrollView>
                              </Box>
                            </VStack>

                            {/* Minute row — evenly spaced across full width */}
                            <VStack gap="$1.5">
                              <Text size="xs" color="$typographySecondary" fontWeight="500">
                                {t("notification.otherTiming.duha.minuteLabel")}
                              </Text>
                              <HStack
                                gap="$2"
                                alignItems="center"
                                accessibilityRole="radiogroup"
                                accessibilityLabel={t("notification.otherTiming.duha.minuteLabel")}>
                                {MINUTE_OPTIONS.map((minute) => {
                                  const isSelected = duhaTime.minute === minute;
                                  // The colon is neutral: it would move to the far side in RTL.
                                  const display = `${LTR_ISOLATE.OPEN}${formatNumberToLocale(
                                    `:${String(minute).padStart(2, "0")}`
                                  )}${LTR_ISOLATE.CLOSE}`;
                                  return (
                                    <Pressable
                                      key={minute}
                                      onPress={() => {
                                        hapticSelection();
                                        updateDuhaTime(duhaTime.hour, minute);
                                      }}
                                      accessibilityRole="radio"
                                      accessibilityState={{ selected: isSelected }}
                                      accessibilityLabel={t("a11y.otherTiming.duhaMinute", {
                                        count: minute,
                                      })}
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
              </Card>

              {/* Section Footer */}
              {group.descriptionKey && (
                <Text size="xs" color="$typographySecondary" paddingHorizontal="$5">
                  {t(group.descriptionKey(midnightMode))}
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
