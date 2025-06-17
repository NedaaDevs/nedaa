import { format, parseISO, formatDistance } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { toHijri } from "hijri-date-converter";
import { useTranslation } from "react-i18next";
import { useEffect } from "react";

// Utils
import { formatNumberToLocale } from "@/utils/number";
import { getDateLocale, isFriday, timeZonedNow } from "@/utils/date";

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
import PreviousPrayer from "@/components/PreviousPrayer";
import { SkeletonText } from "@/components/ui/skeleton";

// Hooks
import { useAppVisibility } from "@/hooks/useAppVisibility";

const Header = () => {
  const { t } = useTranslation();
  const { locale } = useAppStore();
  const { localizedLocation, locationDetails } = useLocationStore();
  const { getNextPrayer } = usePrayerTimesStore();
  const { becameActiveAt } = useAppVisibility();

  useEffect(() => {}, [becameActiveAt]);

  const nextPrayer = getNextPrayer();
  const now = timeZonedNow(locationDetails.timezone);
  const hijriDate = toHijri(now);

  // Get human-readable time remaining
  const getFormattedTimeRemaining = () => {
    if (!nextPrayer) return "";
    const prayerTime = parseISO(nextPrayer.time);
    const timeRemaining = formatDistance(prayerTime, now, {
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

  if (!nextPrayer) {
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

  const prayerName =
    nextPrayer.name === "dhuhr" && isFriday(locationDetails.timezone)
      ? "prayerTimes.jumuah"
      : `prayerTimes.${nextPrayer.name}`;

  return (
    <Box className="m-1 rounded-2xl">
      <Box className="p-3 rounded-xl mx-2 mt-1 border-s-hairline">
        <VStack className="items-center my-3">
          <Text className="text-2xl font-bold text-typography">{dayName}</Text>
          <Text className="text-lg text-typography-secondary">{formattedDateDetails}</Text>
        </VStack>
      </Box>

      <VStack className="items-center mb-2">
        <Box className="h-px flex-1 bg-outline" />
        <Text className="mx-4 text-2xl font-semibold text-typography">
          {localizedLocation.city ?? locationDetails.address?.city}
        </Text>
        <Box className="h-px flex-1 bg-outline" />

        <Text className="text-base text-typography-secondary">
          {localizedLocation.country ?? locationDetails.address?.country}
        </Text>
      </VStack>

      <PreviousPrayer />

      <Box className="p-8 bg-background-secondary  rounded-xl mx-1 mt-2 mb-2 border-s-hairline">
        <HStack className="justify-between items-center w-full space-x-4">
          <Text className="text-4xl font-bold text-accent-primary truncate max-w-[45%]">
            {t(prayerName)}
          </Text>

          <Divider className="h-14 w-px flex-shrink-0 bg-outline" />

          <VStack className="items-end max-w-[45%]">
            <Text className="text-4xl font-semibold text-accent-primary truncate">
              {formattedPrayerTime(nextPrayer.time)}
            </Text>

            <Box className="mt-1 px-4 py-1 rounded-full bg-background-interactive">
              <Text className="text-center text-typography">{getFormattedTimeRemaining()}</Text>
            </Box>
          </VStack>
        </HStack>
      </Box>
    </Box>
  );
};

export default Header;
