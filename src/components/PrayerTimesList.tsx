import { useEffect } from "react";
import { useTranslation } from "react-i18next";

// Components
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import TimingItem from "@/components/TimingItem";

// Icons
import { Sun, Sunset, Sunrise, Moon } from "lucide-react-native";

// Utils
import { isFriday } from "@/utils/date";

// Types
import { PrayerName } from "@/types/prayerTimes";

// Stores
import { usePrayerTimesStore } from "@/stores/prayerTimes";

// Hooks
import { useAppVisibility } from "@/hooks/useAppVisibility";

const prayerIcons: Record<PrayerName, React.ElementType> = {
  fajr: Sunrise,
  dhuhr: Sun,
  asr: Sun,
  maghrib: Sunset,
  isha: Moon,
};

const PrayerTimesList = () => {
  const { t } = useTranslation();
  const { todayTimings, getNextPrayer } = usePrayerTimesStore();
  const nextPrayer = getNextPrayer();

  const { becameActiveAt } = useAppVisibility();

  useEffect(() => {
    console.log("Became visable prayer  timings");
  }, [becameActiveAt]);

  if (!todayTimings) {
    return (
      <Box className="p-4">
        <Text>{t("loadingPrayerTimes")}</Text>
      </Box>
    );
  }

  return (
    <Box>
      {Object.entries(todayTimings.timings).map(([prayer, time]) => {
        const prayerName = prayer as PrayerName;

        const isNext = nextPrayer?.name === prayer;

        const name =
          prayerName === "dhuhr" && isFriday(todayTimings.timezone)
            ? "prayerTimes.jumuah"
            : `prayerTimes.${prayerName}`;

        return (
          <TimingItem
            key={prayerName}
            name={name}
            time={time}
            icon={prayerIcons[prayerName]}
            isNext={isNext}
          />
        );
      })}
    </Box>
  );
};

export default PrayerTimesList;
