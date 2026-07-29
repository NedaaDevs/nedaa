import { parseISO, formatDistance, differenceInMinutes } from "date-fns";
import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";

// Utils
import { formatNumberToLocale } from "@/utils/number";
import { formatPrayerTime, getDateLocale, isFriday } from "@/utils/date";

// Stores
import { useAppStore } from "@/stores/app";
import { useLocationStore } from "@/stores/location";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { usePreferencesStore } from "@/stores/preferences";

// Components
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";

const PreviousPrayer = () => {
  const { t } = useTranslation();
  const { locale } = useAppStore();
  const { locationDetails } = useLocationStore();
  const { todayTimings, getPreviousPrayer } = usePrayerTimesStore();
  const use24HourTime = usePreferencesStore((s) => s.use24HourTime);
  const [timeElapsed, setTimeElapsed] = useState("");
  const [showPrevious, setShowPrevious] = useState(false);

  const previousPrayer = todayTimings ? getPreviousPrayer() : null;

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    if (previousPrayer) {
      const checkAndUpdateTimer = () => {
        // A real instant: prayer times carry the location's offset, so this
        // comparison must not be shifted by the device's zone.
        const currentTime = new Date();
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

  const formattedPrayerTime = (date: string) =>
    formatNumberToLocale(
      formatPrayerTime(date, locationDetails.timezone, { locale, use24HourTime })
    );

  if (!todayTimings || !showPrevious || !previousPrayer) return null;

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
