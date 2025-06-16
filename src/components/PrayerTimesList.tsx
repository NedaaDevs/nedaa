import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, View } from "react-native";

// Components
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

  useEffect(() => {}, [becameActiveAt]);

  if (!todayTimings) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text>{t("loadingPrayerTimes")}</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{
        paddingBottom: 100,
        paddingTop: 10,
      }}
      scrollEventThrottle={16}
      bounces={true}
      alwaysBounceVertical={true}
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled={true}
      scrollEnabled={true}>
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
    </ScrollView>
  );
};

export default PrayerTimesList;
