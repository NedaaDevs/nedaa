import { useTranslation } from "react-i18next";
import { ScrollView, View } from "react-native";

// Components
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
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text>{t("loadingPrayerTimings")}</Text>
      </View>
    );
  }

  const findNext = () => {
    const now = new Date();
    const timings = Object.entries(todayTimings.otherTimings);

    // Convert all timings to Date objects with their names
    const timingsWithDates = timings.map(([name, time]) => ({
      name: name as OtherTimingName,
      time,
      date: new Date(time),
    }));

    // Sort by time
    timingsWithDates.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Find the next timing after current time
    const nextTiming = timingsWithDates.find((timing) => timing.date > now);

    // If no timing is found for today, the first timing of tomorrow would be next
    // But this list should be updated with next day timings after Isha
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
        paddingBottom: 40,
        paddingTop: 10,
      }}
      scrollEventThrottle={16}
      bounces={true}
      alwaysBounceVertical={true}>
      {sortedEntries.map(([timing, time]) => {
        const timingName = timing as OtherTimingName;
        const isNext = timingName === nextTimingName;

        return (
          <TimingItem
            key={timingName}
            name={t(`otherTimings.${translationKey[timingName]}`)}
            time={time}
            icon={otherTimingIcons[timingName]}
            isNext={isNext}
          />
        );
      })}
    </ScrollView>
  );
};

export default OtherTimingsList;
