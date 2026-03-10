import { format, parseISO, formatDistance } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

import { useTranslation } from "react-i18next";
import { useEffect, useState, useCallback, useMemo } from "react";

// Utils
import { getDateLocale, isFriday, timeZonedNow, HijriNative } from "@/utils/date";

// Stores
import { useAppStore } from "@/stores/app";
import { useLocationStore } from "@/stores/location";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { usePreferencesStore } from "@/stores/preferences";

// Hooks
import { useCountdownTimer } from "@/hooks/useCountdownTimer";

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
  const { todayTimings, getNextPrayer, getNextOtherTiming, getPreviousPrayer } =
    usePrayerTimesStore();
  const { useWesternNumerals } = usePreferencesStore();

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

  const nextPrayer = todayTimings ? getNextPrayer() : null;
  const nextOtherTiming = todayTimings ? getNextOtherTiming() : null;
  const previousPrayer = todayTimings ? getPreviousPrayer() : null;
  const now = timeZonedNow(locationDetails.timezone);
  const todayHijri = HijriNative.today(locationDetails.timezone);
  const hijriDate =
    hijriDaysOffset !== 0 ? HijriNative.addDays(todayHijri, hijriDaysOffset) : todayHijri;

  const timing = showOtherTiming ? nextOtherTiming : nextPrayer;

  const {
    mode: timerMode,
    display: timerDisplay,
    iqamaPrayerName,
  } = useCountdownTimer(nextPrayer, previousPrayer, locationDetails.timezone);

  // Local wrapper so React Compiler tracks locale + useWesternNumerals as dependencies
  const formatNum = (str: string) => {
    if (locale.startsWith("ar") && !useWesternNumerals) {
      const arabicDigits = "٠١٢٣٤٥٦٧٨٩";
      return str.replace(/[0-9]/g, (d: string) => arabicDigits[parseInt(d)]);
    }
    return str;
  };

  const otherTimingDisplay = useMemo(() => {
    if (!nextOtherTiming) return "";
    const otherTime = parseISO(nextOtherTiming.time);
    return formatNum(
      formatDistance(otherTime, now, {
        addSuffix: false,
        locale: getDateLocale(locale),
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- formatNum is stable within same locale/useWesternNumerals values
  }, [nextOtherTiming, now, locale, useWesternNumerals]);

  const dayName = format(now, "EEEE", { locale: getDateLocale(locale) });

  const hijriMonth = t(`hijriMonths.${hijriDate.month - 1}`);

  const formattedDay = formatNum(hijriDate.day.toString());
  const formattedYear = formatNum(hijriDate.year.toString());

  const formattedDateDetails = `${formattedDay} ${hijriMonth} ${formattedYear}`;

  const formattedPrayerTime = (date: string) => {
    const parsedDate = parseISO(date);
    return formatNum(
      formatInTimeZone(parsedDate, locationDetails.timezone, "h:mm a", {
        locale: getDateLocale(locale),
      })
    );
  };

  if (!todayTimings || !timing) {
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
          <Text size="xl" bold color="$typography" textAlign="center" width="100%">
            {dayName}
          </Text>
          <Text size="md" color="$typographySecondary" textAlign="center" width="100%">
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
        accessibilityRole="button"
        accessibilityLabel={t("a11y.header.nextPrayer", {
          name: t(timingName),
          time: showOtherTiming ? otherTimingDisplay : formattedPrayerTime(timing.time),
          countdown: showOtherTiming ? otherTimingDisplay : timerDisplay,
        })}
        accessibilityHint={t("a11y.header.toggleTimings")}>
        <HStack justifyContent="space-between" alignItems="center" width="100%">
          <Box flexShrink={1}>
            <Text size="2xl" bold color="$accentPrimary">
              {!showOtherTiming && timerMode === "iqama" && iqamaPrayerName
                ? `${t(`prayerTimes.${iqamaPrayerName}`)} - ${t("header.iqama")}`
                : t(timingName)}
            </Text>
          </Box>

          <Divider
            orientation="vertical"
            height={40}
            width={1}
            marginHorizontal="$3"
            backgroundColor="$outline"
          />

          <VStack alignItems="center" gap="$1">
            <Text size="2xl" fontWeight="600" color="$accentPrimary" textAlign="center">
              {!showOtherTiming && timerMode === "iqama" && previousPrayer
                ? formattedPrayerTime(previousPrayer.time)
                : formattedPrayerTime(timing.time)}
            </Text>

            <Box
              paddingHorizontal="$3"
              paddingVertical="$0.5"
              borderRadius={999}
              backgroundColor="$backgroundInteractive">
              <Text size="sm" textAlign="center" color="$typography">
                {showOtherTiming ? otherTimingDisplay : timerDisplay}
              </Text>
            </Box>
          </VStack>
        </HStack>
      </Pressable>
    </Box>
  );
};

export default Header;
