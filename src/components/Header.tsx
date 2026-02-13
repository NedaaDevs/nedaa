import { format, parseISO, formatDistance } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

import { useTranslation } from "react-i18next";
import { useEffect, useState, useCallback } from "react";

// Utils
import { formatNumberToLocale } from "@/utils/number";
import { getDateLocale, isFriday, timeZonedNow, HijriConverter } from "@/utils/date";

// Stores
import { useAppStore } from "@/stores/app";
import { useLocationStore } from "@/stores/location";
import { usePrayerTimesStore } from "@/stores/prayerTimes";

// Components
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Divider } from "@/components/ui/divider";
import { Pressable } from "@/components/ui/pressable";
import PreviousPrayer from "@/components/PreviousPrayer";
import { SkeletonText } from "@/components/ui/skeleton";

// Types
import { OtherTimingName } from "@/types/prayerTimes";

const Header = () => {
  const { t } = useTranslation();
  const { locale, hijriDaysOffset } = useAppStore();
  const { localizedLocation, locationDetails } = useLocationStore();
  const { getNextPrayer, getNextOtherTiming } = usePrayerTimesStore();

  const [showOtherTiming, setShowOtherTiming] = useState(false);

  useEffect(() => {
    if (showOtherTiming) {
      const timer = setTimeout(() => {
        setShowOtherTiming(false);
      }, 10000);

      return () => clearTimeout(timer);
    }
  }, [showOtherTiming]);

  const handleBoxClick = useCallback(() => {
    setShowOtherTiming((current) => !current);
  }, []);

  const nextPrayer = getNextPrayer();
  const nextOtherTiming = getNextOtherTiming();
  const now = timeZonedNow(locationDetails.timezone);
  const hijriDate = HijriConverter.toHijri(now, hijriDaysOffset);

  const timing = showOtherTiming ? nextOtherTiming : nextPrayer;

  const getFormattedTimeRemaining = () => {
    if (!timing) return "";
    const timingDate = parseISO(timing.time);
    const timeRemaining = formatDistance(timingDate, now, {
      addSuffix: false,
      locale: getDateLocale(locale),
    });
    return formatNumberToLocale(timeRemaining);
  };

  const dayName = format(now, "EEEE", { locale: getDateLocale(locale) });

  const hijriMonth = t(`hijriMonths.${hijriDate.month - 1}`);

  const formattedDay = formatNumberToLocale(hijriDate.day.toString());
  const formattedYear = formatNumberToLocale(hijriDate.year.toString());

  const formattedDateDetails = `${formattedDay} ${hijriMonth} ${formattedYear}`;

  const formattedPrayerTime = (date: string) => {
    const parsedDate = parseISO(date);
    return formatNumberToLocale(
      formatInTimeZone(parsedDate, locationDetails.timezone, "h:mm a", {
        locale: getDateLocale(locale),
      })
    );
  };

  if (!timing) {
    return (
      <Box margin="$1" borderRadius="$7">
        <Box
          padding="$3"
          borderRadius="$6"
          marginHorizontal="$2"
          marginTop="$1"
          backgroundColor="$backgroundSecondary">
          <VStack alignItems="center" marginVertical="$3" gap="$2">
            <SkeletonText style={{ height: 28, width: 128 }} />
            <SkeletonText style={{ height: 20, width: 160 }} />
          </VStack>
        </Box>
      </Box>
    );
  }

  const translationKey: Record<OtherTimingName, string> = {
    sunrise: "sunrise",
    sunset: "sunset",
    imsak: "imsak",
    midnight: "midnight",
    firstthird: "firstThird",
    lastthird: "lastThird",
  };

  const timingName = showOtherTiming
    ? `otherTimings.${translationKey[timing.name as OtherTimingName]}`
    : timing.name === "dhuhr" && isFriday(locationDetails.timezone)
      ? "prayerTimes.jumuah"
      : `prayerTimes.${timing.name}`;

  return (
    <Box margin="$1" borderRadius="$7">
      <Box padding="$3" borderRadius="$6" marginHorizontal="$2" marginTop="$1">
        <VStack alignItems="center" gap="$0.5">
          <Text size="xl" bold color="$typography" textAlign="center" numberOfLines={1}>
            {dayName}
          </Text>
          <Text size="md" color="$typographySecondary" textAlign="center">
            {formattedDateDetails}
          </Text>
        </VStack>
      </Box>

      <VStack alignItems="center" marginVertical="$1" gap="$0.5">
        <Text
          size="lg"
          fontWeight="600"
          color="$typography"
          textAlign="center"
          paddingHorizontal="$2"
          numberOfLines={1}>
          {localizedLocation.city ?? locationDetails.address?.city}
        </Text>
        <Text
          size="sm"
          color="$typographySecondary"
          textAlign="center"
          paddingHorizontal="$2"
          numberOfLines={1}>
          {localizedLocation.country ?? locationDetails.address?.country}
        </Text>
      </VStack>

      <PreviousPrayer />

      <Pressable
        padding="$6"
        backgroundColor="$backgroundSecondary"
        borderRadius="$6"
        marginHorizontal="$1"
        marginTop="$2"
        marginBottom="$2"
        onPress={handleBoxClick}
        accessibilityRole="button">
        <HStack justifyContent="space-between" alignItems="center" width="100%" gap="$4">
          <Text size="2xl" bold color="$accentPrimary" flex={1} numberOfLines={1}>
            {t(timingName)}
          </Text>

          <Divider
            orientation="vertical"
            height={40}
            width={1}
            flexShrink={0}
            backgroundColor="$outline"
          />

          <VStack alignItems="center" gap="$1">
            <Text size="2xl" fontWeight="600" color="$accentPrimary" textAlign="center">
              {formattedPrayerTime(timing.time)}
            </Text>

            <Box
              paddingHorizontal="$3"
              paddingVertical="$0.5"
              borderRadius={999}
              backgroundColor="$backgroundInteractive">
              <Text size="sm" textAlign="center" color="$typography">
                {getFormattedTimeRemaining()}
              </Text>
            </Box>
          </VStack>
        </HStack>
      </Pressable>
    </Box>
  );
};

export default Header;
