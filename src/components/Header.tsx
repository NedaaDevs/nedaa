import { format, parseISO, formatDistance } from "date-fns";

import { useTranslation } from "react-i18next";
import { useEffect, useState, useCallback, useMemo } from "react";

// Utils
import { formatPrayerTime, getDateLocale, isFriday, timeZonedNow, HijriNative } from "@/utils/date";
import { prayerElapsedFraction } from "@/utils/prayerArc";

// Stores
import { useAppStore } from "@/stores/app";
import { useLocationStore } from "@/stores/location";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { usePreferencesStore } from "@/stores/preferences";

// Hooks
import { useCountdownTimer } from "@/hooks/useCountdownTimer";
import { useScreenshotSeed } from "@/screenshot-mode/useScreenshotSeed";

// Components
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import PreviousPrayer from "@/components/PreviousPrayer";
import PrayerProgressArc from "@/components/PrayerProgressArc";
import { SkeletonText } from "@/components/ui/skeleton";

import { MapPin } from "lucide-react-native";

// Types
import { OtherTimingName, PrayerName } from "@/types/prayerTimes";

const Header = () => {
  const { t } = useTranslation();
  const { locale, hijriDaysOffset } = useAppStore();
  const { localizedLocation, locationDetails } = useLocationStore();
  const { todayTimings, getNextPrayer, getNextOtherTiming, getPreviousPrayer } =
    usePrayerTimesStore();
  const { useWesternNumerals, use24HourTime } = usePreferencesStore();

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

  const screenshotSeed = useScreenshotSeed("prayer-times");

  const nextPrayer = todayTimings ? getNextPrayer() : null;
  const nextOtherTiming = todayTimings ? getNextOtherTiming() : null;
  const previousPrayer = todayTimings ? getPreviousPrayer() : null;
  // Two different notions of "now", and they are not interchangeable.
  // zonedNow reads as the location's wall clock — right for naming the day.
  // now is a real instant — right for anything compared against a stored time,
  // which already carries the location's UTC offset.
  const zonedNow = timeZonedNow(locationDetails.timezone);
  const now = new Date();
  const todayHijri = HijriNative.today(locationDetails.timezone);

  // localizedLocation is the locale-aware source (in screenshot mode it is
  // seeded per-locale); the preset's plain-string city would render English
  // under an Arabic UI, so it is intentionally not used for display.
  const displayCity = localizedLocation.city ?? locationDetails.address?.city;

  const displayNextPrayer = (() => {
    if (!screenshotSeed || !todayTimings) return nextPrayer;
    const seedName = screenshotSeed.nextPrayer.toLowerCase() as PrayerName;
    const seedTime = todayTimings.timings[seedName];
    if (!seedTime) return nextPrayer;
    return { name: seedName, time: seedTime, date: todayTimings.date };
  })();

  const hijriDate =
    hijriDaysOffset !== 0 ? HijriNative.addDays(todayHijri, hijriDaysOffset) : todayHijri;

  const timing = showOtherTiming ? nextOtherTiming : displayNextPrayer;

  const {
    mode: timerMode,
    display: timerDisplay,
    iqamaPrayerName,
  } = useCountdownTimer(displayNextPrayer, previousPrayer);

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

  const dayName = format(zonedNow, "EEEE", { locale: getDateLocale(locale) });

  const hijriMonth = t(`hijriMonths.${hijriDate.month - 1}`);

  const formattedDay = formatNum(hijriDate.day.toString());
  const formattedYear = formatNum(hijriDate.year.toString());

  const formattedDateDetails = `${formattedDay} ${hijriMonth} ${formattedYear}`;

  const formattedPrayerTime = (date: string) =>
    formatNum(formatPrayerTime(date, locationDetails.timezone, { locale, use24HourTime }));

  if (!todayTimings || !timing) {
    return (
      <Box margin="$1" borderRadius="$7">
        <Card padding="$3" marginHorizontal="$2" marginTop="$1">
          <VStack alignItems="center" marginVertical="$3" gap="$2">
            <SkeletonText style={{ height: 28, width: 128 }} />
            <SkeletonText style={{ height: 20, width: 160 }} />
          </VStack>
        </Card>
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

  // How far through the current prayer window we are, for the arc.
  const elapsedFraction =
    previousPrayer && displayNextPrayer
      ? prayerElapsedFraction(parseISO(previousPrayer.time), parseISO(displayNextPrayer.time), now)
      : 0;

  const headlineName =
    !showOtherTiming && timerMode === "iqama" && iqamaPrayerName
      ? `${t(`prayerTimes.${iqamaPrayerName}`)} - ${t("header.iqama")}`
      : t(timingName);

  const headlineTime =
    !showOtherTiming && timerMode === "iqama" && previousPrayer
      ? formattedPrayerTime(previousPrayer.time)
      : formattedPrayerTime(timing.time);

  const countdown = showOtherTiming ? otherTimingDisplay : timerDisplay;

  return (
    <Box margin="$1" borderRadius="$7">
      {/* Two condensed lines: where you are, then what day it is. */}
      <VStack alignItems="center" marginTop="$2" gap="$1">
        <HStack alignItems="center" gap="$1.5" paddingHorizontal="$4">
          <Icon as={MapPin} size="sm" color="$typographySecondary" />
          <Text size="sm" fontWeight="600" color="$typography" numberOfLines={1}>
            {displayCity}
          </Text>
        </HStack>
        <Text
          size="xs"
          color="$typographySecondary"
          textTransform="uppercase"
          textAlign="center"
          paddingHorizontal="$4"
          numberOfLines={1}>
          {`${dayName} · ${formattedDateDetails}`}
        </Text>
      </VStack>

      <Pressable
        alignItems="center"
        marginTop="$2"
        onPress={handleBoxClick}
        accessibilityRole="button"
        accessibilityLabel={t("a11y.header.nextPrayer", {
          name: t(timingName),
          time: showOtherTiming ? otherTimingDisplay : formattedPrayerTime(timing.time),
          countdown,
        })}
        accessibilityHint={t("a11y.header.toggleTimings")}>
        <PrayerProgressArc progress={elapsedFraction}>
          <VStack alignItems="center" gap="$1" paddingHorizontal="$8">
            <Text size="lg" fontWeight="600" color="$accentPrimary" numberOfLines={1}>
              {headlineName}
            </Text>
            {/* The hero. Presence comes from scale, not weight. */}
            <Text fontSize={48} numeric fontWeight="500" color="$typography" textAlign="center">
              {countdown}
            </Text>
            <Text size="md" numeric fontWeight="600" color="$accentPrimary">
              {headlineTime}
            </Text>
          </VStack>
        </PrayerProgressArc>
      </Pressable>

      <PreviousPrayer />
    </Box>
  );
};

export default Header;
