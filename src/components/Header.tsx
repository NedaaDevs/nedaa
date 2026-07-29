import { format, parseISO, differenceInSeconds } from "date-fns";

import { useTranslation } from "react-i18next";
import { useEffect, useState, useCallback, useMemo } from "react";

// Utils
import { formatPrayerTime, getDateLocale, isFriday, timeZonedNow, HijriNative } from "@/utils/date";
import { elapsedWindowFraction } from "@/utils/prayerArc";
import { formatHoursMinutes } from "@/utils/countdown";

// Stores
import { useAppStore } from "@/stores/app";
import { useLocationStore } from "@/stores/location";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { usePreferencesStore } from "@/stores/preferences";

// Hooks
import { useCountdownTimer } from "@/hooks/useCountdownTimer";
import { useMinuteClock } from "@/hooks/useMinuteClock";
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
  const {
    todayTimings,
    getNextPrayer,
    getNextOtherTiming,
    getPreviousPrayer,
    getPreviousOtherTiming,
  } = usePrayerTimesStore();
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

  // Ticks the clock so these recompute at a prayer boundary, not just on new timings.
  const now = useMinuteClock();
  const nextPrayer = todayTimings ? getNextPrayer(now) : null;
  const nextOtherTiming = todayTimings ? getNextOtherTiming(now) : null;
  const previousPrayer = todayTimings ? getPreviousPrayer(now) : null;
  const previousOtherTiming = todayTimings ? getPreviousOtherTiming(now) : null;
  // zonedNow for wall-clock display, now for comparing against stored times.
  const zonedNow = timeZonedNow(locationDetails.timezone);
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

  // Stay on the prayer when there is no other timing, rather than blanking the card.
  const showingOther = showOtherTiming && nextOtherTiming != null;
  const timing = showingOther ? nextOtherTiming : displayNextPrayer;

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

  // Same H:MM as the prayer countdown; they share the hero.
  const otherTimingDisplay = useMemo(() => {
    if (!nextOtherTiming) return "";
    const seconds = differenceInSeconds(parseISO(nextOtherTiming.time), now);
    return formatNum(formatHoursMinutes(seconds));
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

  const timingName = showingOther
    ? `otherTimings.${translationKey[timing.name as OtherTimingName]}`
    : timing.name === "dhuhr" && isFriday(locationDetails.timezone)
      ? "prayerTimes.jumuah"
      : `prayerTimes.${timing.name}`;

  // The arc wraps the countdown, so it measures whichever window is displayed.
  const windowFrom = showingOther ? previousOtherTiming : previousPrayer;
  const windowTo = showingOther ? nextOtherTiming : displayNextPrayer;
  const elapsedFraction =
    windowFrom && windowTo
      ? elapsedWindowFraction(parseISO(windowFrom.time), parseISO(windowTo.time), now)
      : 0;

  const headlineName =
    !showingOther && timerMode === "iqama" && iqamaPrayerName
      ? `${t(`prayerTimes.${iqamaPrayerName}`)} - ${t("header.iqama")}`
      : t(timingName);

  const headlineTime =
    !showingOther && timerMode === "iqama" && previousPrayer
      ? formattedPrayerTime(previousPrayer.time)
      : formattedPrayerTime(timing.time);

  const countdown = showingOther ? otherTimingDisplay : timerDisplay;

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
          time: showingOther ? otherTimingDisplay : formattedPrayerTime(timing.time),
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
