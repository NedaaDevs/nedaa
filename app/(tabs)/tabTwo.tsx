import { SafeAreaView } from "react-native-safe-area-context";
import { ScrollView } from "react-native";
import { useEffect, useState } from "react";
import { parseISO, addDays, subDays } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { useLocationStore } from "@/stores/location";
import { useAppStore } from "@/stores/app";
import { dateToInt, timeZonedNow } from "@/utils/date";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Button, ButtonText } from "@/components/ui/button";
import { Divider } from "@/components/ui/divider";
import { formatDistance } from "date-fns";
import { ar, enUS, ms } from "date-fns/locale";
import { useTranslation } from "react-i18next";
import { Prayer, PrayerName } from "@/types/prayerTimes";
import { usePrayerTimesStore } from "@/stores/prayerTimes";

type FormattedPrayerTime = {
  name: string;
  time: string;
  status: string;
  isNext?: boolean;
  isPrevious?: boolean;
};

type ViewMode = "yesterday" | "today" | "tomorrow";

export default function PrayerTimesScreen() {
  const { locationDetails } = useLocationStore();
  const { locale } = useAppStore();
  const {
    yesterdayTimings,
    todayTimings,
    tomorrowTimings,
    loadPrayerTimes,
    getNextPrayer,
    getPreviousPrayer,
  } = usePrayerTimesStore();

  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState<ViewMode>("today");
  const [prayerTimes, setPrayerTimes] = useState<FormattedPrayerTime[]>([]);
  const [date, setDate] = useState<string>("");

  const [nextPrayer, setNextPrayer] = useState<Prayer | null>(null);
  const [previousPrayer, setPreviousPrayer] = useState<Prayer | null>(null);

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

  const formatNumberToLocale = (str: string) => {
    if (locale.startsWith("ar")) {
      const arabicDigits = "٠١٢٣٤٥٦٧٨٩";
      return str.replace(/[0-9]/g, (digit: string): string => arabicDigits[parseInt(digit)]);
    }
    return str;
  };

  const getCurrentTimings = () => {
    switch (viewMode) {
      case "yesterday":
        return yesterdayTimings;
      case "tomorrow":
        return tomorrowTimings;
      default:
        return todayTimings;
    }
  };

  const handlePrevDay = () => {
    if (viewMode === "today") setViewMode("yesterday");
    if (viewMode === "tomorrow") setViewMode("today");
  };

  const handleNextDay = () => {
    if (viewMode === "yesterday") setViewMode("today");
    if (viewMode === "today") setViewMode("tomorrow");
  };

  useEffect(() => {
    const updatePrayerTimes = async () => {
      try {
        if (!locationDetails.timezone) return;

        const time = timeZonedNow(locationDetails.timezone);
        const todayInt = dateToInt(time);
        const dateLocale = getDateLocale();

        // Load the prayer times into the store
        await loadPrayerTimes(todayInt);

        // Get the current timings based on view mode
        const currentTimings = getCurrentTimings();

        if (currentTimings) {
          const formattedTimes: FormattedPrayerTime[] = (
            Object.keys(currentTimings.timings) as PrayerName[]
          ).map((name) => {
            const timeStr = currentTimings.timings[name];
            const parsedDate = parseISO(timeStr as string);

            const status = formatNumberToLocale(
              formatDistance(parsedDate, time, {
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
              isNext: nextPrayer?.name === name && nextPrayer?.date === currentTimings.date,
              isPrevious:
                previousPrayer?.name === name && previousPrayer?.date === currentTimings.date,
            };
          });

          setPrayerTimes(formattedTimes);

          // Adjust date based on view mode
          const dateToShow =
            viewMode === "yesterday"
              ? subDays(time, 1)
              : viewMode === "tomorrow"
                ? addDays(time, 1)
                : time;

          const formattedDate = formatNumberToLocale(
            formatInTimeZone(dateToShow, locationDetails.timezone, "MMMM d, yyyy", {
              locale: dateLocale,
            })
          );
          setDate(formattedDate);
        }
      } catch (error) {
        console.error("Error loading times:", error);
      }
    };

    updatePrayerTimes();
    setNextPrayer(getNextPrayer());
    setPreviousPrayer(getPreviousPrayer());
  }, [locationDetails.timezone, locale, t, viewMode]);

  return (
    <SafeAreaView className="flex-1 bg-background-50">
      <ScrollView>
        <Box className="px-4 py-6">
          <Text className="text-2xl font-bold text-center text-typography-800 mb-4">
            {t("prayerTimes.title")}
          </Text>
          <Text className="text-2xl font-bold text-center text-typography-800 mb-4">{date}</Text>

          {/* Navigation Buttons */}
          <Box className="space-y-4 mt-6">
            <Button
              className="rounded-xl bg-info-400 shadow-lg active:opacity-80 h-14"
              onPress={handlePrevDay}
              disabled={viewMode === "yesterday"}>
              <ButtonText className="text-lg font-bold text-background-0 text-center w-full">
                {t("prayerTimes.yesterday")}
              </ButtonText>
            </Button>

            <Button
              className="rounded-xl bg-tertiary-400 shadow-lg active:opacity-80 h-14 my-5"
              onPress={handleNextDay}
              disabled={viewMode === "tomorrow"}>
              <ButtonText className="text-lg font-bold text-background-0 text-center w-full">
                {t("prayerTimes.tomorrow")}
              </ButtonText>
            </Button>
          </Box>

          <Text className="text-lg text-center text-typography-600 mb-4">
            {locationDetails.address?.city}
          </Text>
          <Divider className="h-0.5 bg-outline-200 mb-6" />

          <Box className="space-y-6">
            {prayerTimes.map((prayer) => (
              <Box
                key={prayer.name}
                className={`p-4 rounded-xl ${
                  prayer.isNext
                    ? "bg-primary border-2 border-primary"
                    : prayer.isPrevious
                      ? "bg-info border-2 border-info"
                      : "bg-background-100"
                }`}>
                <Box className="flex-row justify-between items-start">
                  <Box className="space-y-1">
                    <Text className="text-2xl font-bold text-typography-900">{prayer.name}</Text>
                    <Text className="text-base text-typography-600">{prayer.status}</Text>
                  </Box>
                  <Text className="text-2xl font-bold text-typography-800">{prayer.time}</Text>
                </Box>
              </Box>
            ))}
          </Box>

          {previousPrayer && (
            <>
              <Divider className="h-0.5 bg-outline-200 mb-6" />
              <Box className="space-y-4">
                <Box key="previous" className="items-start">
                  <Box className="flex-row justify-between items-center w-full">
                    <Box>
                      <Text className="text-xl font-semibold text-typography-700">
                        {t(`prayerTimes.prayers.${previousPrayer.name}`)}
                      </Text>
                      <Text className="text-sm text-typography-500">{previousPrayer.time}</Text>
                    </Box>
                    <Text className="text-xl text-typography-600">{previousPrayer.date}</Text>
                  </Box>
                </Box>
              </Box>
            </>
          )}

          {nextPrayer && (
            <>
              <Divider className="h-0.5 bg-outline-200 mb-6" />
              <Box className="space-y-4">
                <Box key="next" className="items-start">
                  <Box className="flex-row justify-between items-center w-full">
                    <Box>
                      <Text className="text-xl font-semibold text-typography-700">
                        {t(`prayerTimes.prayers.${nextPrayer.name}`)}
                      </Text>
                      <Text className="text-sm text-typography-500">{nextPrayer.time}</Text>
                    </Box>
                    <Text className="text-xl text-typography-600">{nextPrayer.date}</Text>
                  </Box>
                </Box>
              </Box>
            </>
          )}
        </Box>
      </ScrollView>
    </SafeAreaView>
  );
}
