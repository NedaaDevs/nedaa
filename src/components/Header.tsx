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

// Hooks
import { useAppVisibility } from "@/hooks/useAppVisibility";

const Header = () => {
  const { t } = useTranslation();
  const { locale, hijriDaysOffset } = useAppStore();
  const { localizedLocation, locationDetails } = useLocationStore();
  const { getNextPrayer, getNextOtherTiming } = usePrayerTimesStore();
  const { becameActiveAt } = useAppVisibility();

  const [showOtherTiming, setShowOtherTiming] = useState(false);

  // Reset the timing display after 10 seconds
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

  // Get human-readable time remaining
  const getFormattedTimeRemaining = () => {
    if (!timing) return "";
    const timingDate = parseISO(timing.time);
    const timeRemaining = formatDistance(timingDate, now, {
      addSuffix: false,
      locale: getDateLocale(locale),
    });
    return formatNumberToLocale(timeRemaining);
  };

  // Format day name "Friday"
  const dayName = format(now, "EEEE", { locale: getDateLocale(locale) });

  // Get localized month name "رمضان or Ramadan"
  const hijriMonth = t(`hijriMonths.${hijriDate.month - 1}`);

  // Format numbers for Arabic locale
  const formattedDay = formatNumberToLocale(hijriDate.day.toString());
  const formattedYear = formatNumberToLocale(hijriDate.year.toString());

  // Format date components separately now
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
      <Box className="m-1 rounded-2xl">
        <Box className="p-3 rounded-xl mx-2 mt-1 bg-background-secondary">
          <VStack className="items-center my-3 gap-2">
            <SkeletonText className="h-7 w-32" />
            <SkeletonText className="h-5 w-40" />
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
    <Box className="m-1 rounded-2xl">
      <Box className="p-4 rounded-xl mx-2 mt-1 ">
        <VStack className="items-center gap-1">
          <Text className="text-2xl font-bold text-typography text-center">{dayName}</Text>
          <Text className="text-lg text-typography-secondary text-center">
            {formattedDateDetails}
          </Text>
        </VStack>
      </Box>

      <VStack className="items-center my-4 gap-2">
        <VStack className="items-center gap-1">
          <Text className="text-2xl font-semibold text-typography text-center px-4">
            {localizedLocation.city ?? locationDetails.address?.city}
          </Text>
          <Text className="text-base text-typography-secondary text-center px-4">
            {localizedLocation.country ?? locationDetails.address?.country}
          </Text>
        </VStack>
      </VStack>

      <PreviousPrayer />

      <Pressable
        className="p-8 bg-background-secondary rounded-xl mx-1 mt-2 mb-2"
        onPress={handleBoxClick}>
        <HStack className="justify-between items-center w-full gap-4">
          <Text className="text-4xl font-bold text-accent-primary flex-1 text-left">
            {t(timingName)}
          </Text>

          <Divider className="h-14 w-px flex-shrink-0 bg-outline" />

          <VStack className="items-end flex-1">
            <Text className="text-4xl font-semibold text-accent-primary text-right">
              {formattedPrayerTime(timing.time)}
            </Text>

            <Box className="mt-1 px-4 py-1 rounded-full bg-background-interactive">
              <Text className="text-center text-typography">{getFormattedTimeRemaining()}</Text>
            </Box>
          </VStack>
        </HStack>
      </Pressable>
    </Box>
  );
};

export default Header;
