import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView } from "react-native";

// Components
import TimingItem from "@/components/TimingItem";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";

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
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingBottom: 100,
          paddingTop: 10,
        }}
        showsVerticalScrollIndicator={false}>
        {/* Show skeleton loading for 5 prayer times */}
        {Array.from({ length: 5 }).map((_, index) => (
          <Box
            key={`prayer-skeleton-${index}`}
            className="mx-4 mb-3 p-4 rounded-xl bg-background-secondary">
            <VStack className="gap-3">
              {/* Prayer name skeleton */}
              <HStack className="justify-between items-center">
                <SkeletonText className="h-5 w-16" />
                <Skeleton variant="circular" className="h-[24px] w-[24px]" />
              </HStack>

              {/* Prayer time skeleton */}
              <VStack className="items-center gap-2">
                <SkeletonText className="h-8 w-20" />
                <SkeletonText className="h-3 w-12" />
              </VStack>

              {/* Status indicator skeleton */}
              <Box className="items-center">
                <Skeleton variant="rounded" className="h-6 w-16" />
              </Box>
            </VStack>
          </Box>
        ))}
      </ScrollView>
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
