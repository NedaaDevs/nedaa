import { parseISO, formatDistance, differenceInMinutes } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";

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
import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";

const PreviousPrayer = () => {
  const { t } = useTranslation();
  const { locale } = useAppStore();
  const { locationDetails } = useLocationStore();
  const { getPreviousPrayer } = usePrayerTimesStore();
  const [timeElapsed, setTimeElapsed] = useState("");
  const [showPrevious, setShowPrevious] = useState(false);

  const previousPrayer = getPreviousPrayer();

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    if (previousPrayer) {
      const checkAndUpdateTimer = () => {
        const currentTime = timeZonedNow(locationDetails.timezone);
        const prayerTime = parseISO(previousPrayer.time);
        const minutesSincePrayer = differenceInMinutes(currentTime, prayerTime);

        if (minutesSincePrayer <= 30 && minutesSincePrayer > 0) {
          setShowPrevious(true);
          const elapsed = formatDistance(currentTime, prayerTime, {
            addSuffix: false,
            locale: getDateLocale(locale),
          });
          setTimeElapsed(formatNumberToLocale(elapsed));
        } else {
          setShowPrevious(false);
        }
      };

      checkAndUpdateTimer();
      interval = setInterval(checkAndUpdateTimer, 1000 * 30);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [previousPrayer, locale, locationDetails.timezone]);

  const formattedPrayerTime = (date: string) => {
    const parsedDate = parseISO(date);
    return formatNumberToLocale(
      formatInTimeZone(parsedDate, locationDetails.timezone, "h:mm a", {
        locale: getDateLocale(locale),
      })
    );
  };

  if (!showPrevious || !previousPrayer) return null;

  const prayerName =
    previousPrayer.name === "dhuhr" && isFriday(locationDetails.timezone)
      ? "jumuah"
      : previousPrayer.name;

  return (
    <Box
      paddingHorizontal="$4"
      paddingVertical="$3"
      backgroundColor="$backgroundInfo"
      borderRadius="$6"
      marginHorizontal="$2"
      marginTop="$2"
      marginBottom="$2">
      <HStack justifyContent="space-between" alignItems="center" width="100%">
        <Text size="sm" fontWeight="500" color="$typographySecondary" numberOfLines={1}>
          {t(`prayerTimes.${prayerName}`)}
        </Text>

        <VStack alignItems="flex-end" gap="$1">
          <Text size="sm" fontWeight="500" color="$typographySecondary" numberOfLines={1}>
            {formattedPrayerTime(previousPrayer.time)}
          </Text>
          <Text size="xs" color="$info" numberOfLines={1}>
            {t("common.ago", {
              time: timeElapsed,
            })}
          </Text>
        </VStack>
      </HStack>
    </Box>
  );
};

export default PreviousPrayer;
