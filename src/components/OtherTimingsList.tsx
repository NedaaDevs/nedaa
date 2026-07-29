import { useTranslation } from "react-i18next";
import { ScrollView } from "react-native";

// Components
import { Box } from "@/components/ui/box";
import { Card } from "@/components/ui/card";
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
      <Box flex={1} justifyContent="center" alignItems="center">
        <Text>{t("loadingPrayerTimings")}</Text>
      </Box>
    );
  }

  const findNext = () => {
    const now = new Date();
    const timings = Object.entries(todayTimings.otherTimings);

    const timingsWithDates = timings.map(([name, time]) => ({
      name: name as OtherTimingName,
      time,
      date: new Date(time),
    }));

    timingsWithDates.sort((a, b) => a.date.getTime() - b.date.getTime());

    const nextTiming = timingsWithDates.find((timing) => timing.date > now);

    return nextTiming?.name;
  };

  const nextTimingName = findNext();

  const sortedEntries = Object.entries(todayTimings.otherTimings).sort(
    ([, timeA], [, timeB]) => new Date(timeA).getTime() - new Date(timeB).getTime()
  );

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{
        paddingBottom: 16,
        paddingTop: 10,
      }}
      scrollEventThrottle={16}
      bounces={true}
      alwaysBounceVertical={true}
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled={true}
      scrollEnabled={true}>
      <Card variant="grouped" marginHorizontal="$4">
        {sortedEntries.map(([timing, time], index, rows) => {
          const timingName = timing as OtherTimingName;
          const isNext = timingName === nextTimingName;

          return (
            <TimingItem
              key={timingName}
              name={t(`otherTimings.${translationKey[timingName]}`)}
              time={time}
              icon={otherTimingIcons[timingName]}
              isNext={isNext}
              showDivider={index < rows.length - 1}
            />
          );
        })}
      </Card>
    </ScrollView>
  );
};

export default OtherTimingsList;
