import { format, parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { toHijri } from "hijri-date-converter";
import { useTranslation } from "react-i18next";

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
import { Icon } from "@/components/ui/icon";

// Icon
import { MapPin } from "lucide-react-native";

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

  if (!nextPrayer) {
    return (
      <>
        <Text>...</Text>
      </>
    );
  }

  const prayerName =
    nextPrayer.name === "dhuhr" && isFriday(locationDetails.timezone) ? "jumuah" : nextPrayer.name;

  return (
    <Box className="m-2 p-4 rounded-lg bg-background">
      <VStack className="items-start space-y-3">
        <Text className="text-2xl text-right text-white dark:text-secondary">{formattedDate}</Text>

        <HStack className="justify-start my-2">
          <Icon as={MapPin} size="xs" className="text-right text-white dark:text-secondary" />
          <Text className="text-1xl font-bold text-right text-tertiary ms-2">
            {locationDetails.address?.city}
          </Text>
        </HStack>

        {nextPrayer && (
          <HStack className="justify-start w-full">
            <Text className="text-4xl font-bold text-tertiary pr-3">{t(prayerName)}</Text>
            <Text className="text-4xl font-bold text-tertiary  pl-3">
              {formattedPrayerTime(nextPrayer.time)}
            </Text>
          </HStack>
        )}
      </VStack>
    </Box>
  );
};

export default Header;
