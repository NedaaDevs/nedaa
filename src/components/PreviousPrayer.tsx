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
import { Divider } from "@/components/ui/divider";

const PreviousPrayer = () => {
  const { t } = useTranslation();
  const { locale } = useAppStore();
  const { locationDetails } = useLocationStore();
  const { getPreviousPrayer } = usePrayerTimesStore();
  const [timeElapsed, setTimeElapsed] = useState("");
  const [showPrevious, setShowPrevious] = useState(false);

  const previousPrayer = getPreviousPrayer();

  useEffect(() => {
    let interval = null;

    if (previousPrayer) {
      const checkAndUpdateTimer = () => {
        const currentTime = timeZonedNow(locationDetails.timezone);
        const prayerTime = parseISO(previousPrayer.time);
        const minutesSincePrayer = differenceInMinutes(currentTime, prayerTime);

        // Only show if it's within 30 minutes
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

    // Clean up function
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
    <Box className="p-6 bg-background-info rounded-xl mx-2 mt-2 mb-2 border-s-hairline">
      <HStack className="justify-between items-center w-full">
        <HStack className="items-center space-x-4">
          <Text className="text-md font-medium text-typography-secondary">
            {t(`prayerTimes.${prayerName}`)}
          </Text>
          <Divider className="mx-1" orientation="vertical" />
          <Text className="text-md font-medium text-typography-secondary">
            {formattedPrayerTime(previousPrayer.time)}
          </Text>
        </HStack>

        <Box className="px-3 py-0.5 rounded-full bg-background-secondary border border-outline">
          <Text className="text-md font-medium text-info">
            {t("common.ago", {
              time: timeElapsed,
            })}
          </Text>
        </Box>
      </HStack>
    </Box>
  );
};

export default PreviousPrayer;
