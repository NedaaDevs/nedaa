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
      <>
        <Text>...</Text>
      </>
    );
  }

  const prayerName =
    nextPrayer.name === "dhuhr" && isFriday(locationDetails.timezone)
      ? "prayerTimes.jumuah"
      : `prayerTimes.${nextPrayer.name}`;

  return (
    <Box className="m-2 rounded-2xl bg-white dark:bg-slate-900 shadow-md ">
      <VStack className="items-center my-3">
        <Text className="text-2xl font-medium text-slate-700 dark:text-slate-200">{dayName}</Text>
        <Text className="text-lg text-slate-600 dark:text-slate-300">{formattedDateDetails}</Text>
      </VStack>

      <VStack className="items-center mb-3">
        <HStack className="items-center justify-center w-full px-8">
          <Box className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
          <Text className="mx-4 text-2xl font-medium text-slate-600 dark:text-slate-300">
            {localizedLocation.city ?? locationDetails.address?.city}
          </Text>
          <Box className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
        </HStack>

        <Text className="text-base text-slate-400 dark:text-slate-500">
          {localizedLocation.country ?? locationDetails.address?.country}
        </Text>
      </VStack>

      <PreviousPrayer />

      <Box className="p-6 bg-blue-50 dark:bg-slate-800 rounded-xl mx-2 mt-2 mb-2 border-s-hairline">
        <HStack className="justify-between items-center w-full space-x-4">
          <Text className="text-4xl font-bold text-slate-700 dark:text-white truncate max-w-[45%]">
            {t(prayerName)}
          </Text>

          <Divider className="h-14 w-px flex-shrink-0 bg-slate-300 dark:bg-slate-600" />

          <VStack className="items-end max-w-[45%]">
            <Text className="text-4xl font-bold text-blue-600 dark:text-secondary truncate">
              {formattedPrayerTime(nextPrayer.time)}
            </Text>

            <Box className="mt-1 px-4 py-1 rounded-full bg-white dark:bg-slate-900 border border-blue-100 dark:border-secondary">
              <Text className="text-center text-blue-600 dark:text-secondary">
                {getFormattedTimeRemaining()}
              </Text>
            </Box>
          </VStack>
        </HStack>
      </Box>
    </Box>
  );
};

export default Header;
