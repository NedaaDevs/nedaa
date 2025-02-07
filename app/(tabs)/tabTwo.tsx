import { SafeAreaView } from "react-native-safe-area-context";
import { ScrollView } from "react-native";
import { useEffect, useState } from "react";
import { compareAsc, parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { useLocationStore } from "@/stores/location";
import { useAppStore } from "@/stores/app";
import { dateToInt, timeZonedNow } from "@/utils/date";
import { PrayerTimesDB } from "@/services/db";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Divider } from "@/components/ui/divider";
import { formatDistance } from "date-fns";
import { ar, enUS, ms } from "date-fns/locale";
import { useTranslation } from "react-i18next";
import { PrayerName } from "@/types/prayerTimes";

type FormattedPrayerTime = {
  name: string;
  time: string;
  status: string;
};

export default function PrayerTimesScreen() {
  const { locationDetails } = useLocationStore();
  const { locale } = useAppStore();
  const { t } = useTranslation();
  const [prayerTimes, setPrayerTimes] = useState<FormattedPrayerTime[]>([]);
  const [date, setDate] = useState<string>("");

  const getDateLocale = () => {
    switch (locale) {
      case "ar":
        return ar;
      case "ms":
        return ms;
      default:
        return enUS;
    }
  };
  // TODO: move this to a util func
  const formatNumberToLocale = (str: string) => {
    if (locale.startsWith("ar")) {
      const arabicDigits = "٠١٢٣٤٥٦٧٨٩";
      return str.replace(/[0-9]/g, (digit: string): string => arabicDigits[parseInt(digit)]);
    }
    return str;
  };

  useEffect(() => {
    const loadTimes = async () => {
      try {
        if (!locationDetails.timezone) return;

        const time = timeZonedNow(locationDetails.timezone);
        const todayInt = dateToInt(time);
        const dateLocale = getDateLocale();

        const times = await PrayerTimesDB.getPrayerTimesByDate(todayInt);

        if (!times) return;

        const formattedTimes: FormattedPrayerTime[] = (
          Object.keys(times.timings) as PrayerName[]
        ).map((name) => {
          const timeStr = times.timings[name];
          const parsedDate = parseISO(timeStr as string);
          const isPast = compareAsc(time, parsedDate) === 1;

          const status = formatNumberToLocale(
            isPast
              ? formatDistance(parsedDate, time, {
                  includeSeconds: true,
                  locale: dateLocale,
                  addSuffix: true,
                })
              : formatDistance(parsedDate, time, {
                  includeSeconds: true,
                  locale: dateLocale,
                  addSuffix: true,
                })
          );

          const formattedTime = formatNumberToLocale(
            formatInTimeZone(parsedDate, locationDetails.timezone, "h:mm a", {
              locale: dateLocale,
            })
          );

          return {
            name: t(`prayerTimes.prayers.${name}`),
            time: formattedTime,
            status,
          };
        });

        setPrayerTimes(formattedTimes);

        const formattedDate = formatNumberToLocale(
          formatInTimeZone(time, locationDetails.timezone, "MMMM d, yyyy", {
            locale: dateLocale,
          })
        );
        setDate(formattedDate);
      } catch (error) {
        console.error("Error loading times:", error);
      }
    };

    loadTimes();
  }, [locationDetails.timezone, locale, t]);

  return (
    <SafeAreaView className="flex-1 bg-background-50">
      <ScrollView>
        <Box className="px-4 py-6">
          <Text className="text-2xl font-bold text-center text-typography-800 mb-4">
            {t("prayerTimes.title")}
          </Text>
          <Text className="text-lg text-center text-typography-600 mb-4">{date}</Text>
          <Text className="text-lg text-center text-typography-600 mb-4">
            {locationDetails.address?.city}
          </Text>
          <Divider className="h-0.5 bg-outline-200 mb-6" />
          <Box className="space-y-4">
            {prayerTimes.map((prayer) => (
              <Box key={prayer.name} className="items-start">
                <Box className="flex-row justify-between items-center w-full">
                  <Box>
                    <Text className="text-xl font-semibold text-typography-700">{prayer.name}</Text>
                    <Text className="text-sm text-typography-500">{prayer.status}</Text>
                  </Box>
                  <Text className="text-xl text-typography-600">{prayer.time}</Text>
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      </ScrollView>
    </SafeAreaView>
  );
}
