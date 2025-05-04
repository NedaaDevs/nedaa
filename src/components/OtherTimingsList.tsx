import { useTranslation } from "react-i18next";

// Components
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";

import TimingItem from "@/components/TimingItem";

// Icons
import { Sunset, Sunrise, Moon, ClockAlert, MoonStar } from "lucide-react-native";

// Stores
import { usePrayerTimesStore } from "@/stores/prayerTimes";

// Types
import { OtherTimingName } from "@/types/prayerTimes";

const translationKey: Record<OtherTimingName, string> = {
  sunrise: "sunrise",
  sunset: "sunset",
  imsak: "imsak",
  midnight: "midnight",
  firstthird: "firstThird",
  lastthird: "lastThird",
};

const otherTimingIcons: Record<OtherTimingName, React.ElementType> = {
  sunrise: Sunrise,
  sunset: Sunset,
  imsak: ClockAlert,
  midnight: MoonStar,
  firstthird: Moon,
  lastthird: Moon,
};

const OtherTimingsList = () => {
  const { todayTimings } = usePrayerTimesStore();
  const { t } = useTranslation();

  if (!todayTimings || !todayTimings.otherTimings) {
    return (
      <Box className="p-4">
        <Text>{t("loadingPrayerTimings")}</Text>
      </Box>
    );
  }

  return (
    <Box>
      {Object.entries(todayTimings.otherTimings).map(([timing, time]) => {
        const timingName = timing as OtherTimingName;

        return (
          <TimingItem
            key={timingName}
            name={t(translationKey[timingName])}
            time={time}
            icon={otherTimingIcons[timingName]}
          />
        );
      })}
    </Box>
  );
};

export default OtherTimingsList;
