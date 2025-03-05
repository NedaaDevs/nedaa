import { format, parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { toHijri } from "hijri-date-converter";
import { useTranslation } from "react-i18next";

// Utils
import { formatNumberToLocale } from "@/utils/number";
import { getDateLocale, timeZonedNow } from "@/utils/date";

// Stores
import { useAppStore } from "@/stores/app";
import { useLocationStore } from "@/stores/location";
import { usePrayerTimesStore } from "@/stores/prayerTimes";

// Components
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";

const Header = () => {
  const { t } = useTranslation();
  const { locale } = useAppStore();
  const { locationDetails } = useLocationStore();
  const { getNextPrayer } = usePrayerTimesStore();

  const nextPrayer = getNextPrayer();

  const now = timeZonedNow(locationDetails.timezone);
  const hijriDate = toHijri(now);

  // Format day name  "Friday"
  const dayName = format(now, "EEEE", { locale: getDateLocale(locale) });

  // Get localized month name "رمضان or Ramadan"
  const hijriMonth = t(`hijriMonths.${hijriDate.month - 1}`);

  // Format numbers 1=١ for Arabic locale
  const formattedDay = formatNumberToLocale(hijriDate.day.toString());
  const formattedYear = formatNumberToLocale(hijriDate.year.toString());

  const formattedDate = `${dayName}, ${formattedDay} ${hijriMonth} ${formattedYear}`;

  const formattedPrayerTime = (date: string) => {
    const parsedDate = parseISO(date);

    return formatNumberToLocale(
      formatInTimeZone(parsedDate, locationDetails.timezone, "h:mm a", {
        locale: getDateLocale(locale),
      })
    );
  };

  return (
    <Box className="m-2 p-4 rounded-lg bg-background">
      <VStack className="items-start space-y-3">
        <Text className="text-right text-white text-base dark:text-secondary">{formattedDate}</Text>
        {nextPrayer && (
          <HStack className="justify-start w-full space-x-2">
            <Text className="text-4xl font-bold text-tertiary dark:text-typography mx-3">
              {t(nextPrayer.name)}
            </Text>
            <Text className="text-4xl font-bold text-tertiary dark:text-typography">
              {formattedPrayerTime(nextPrayer.time)}
            </Text>
          </HStack>
        )}
      </VStack>
    </Box>
  );
};

export default Header;
