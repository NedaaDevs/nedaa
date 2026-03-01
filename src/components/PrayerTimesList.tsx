import { ScrollView } from "react-native";

// Components
import TimingItem from "@/components/TimingItem";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";
import { EmptyState } from "@/components/feedback";

// Icons
import { Sun, Sunset, Sunrise, Moon } from "lucide-react-native";

// Utils
import { isFriday } from "@/utils/date";

// Types
import { PrayerName } from "@/types/prayerTimes";

// Stores
import { usePrayerTimesStore } from "@/stores/prayerTimes";

const prayerIcons: Record<PrayerName, React.ElementType> = {
  fajr: Sunrise,
  dhuhr: Sun,
  asr: Sun,
  maghrib: Sunset,
  isha: Moon,
};

const PrayerTimesList = () => {
  const { todayTimings, hasError, isLoading, getNextPrayer, loadPrayerTimes, clearError } =
    usePrayerTimesStore();
  const nextPrayer = getNextPrayer();

  const handleRetry = async () => {
    clearError();
    try {
      await loadPrayerTimes(true);
    } catch {
      // Error is handled in the store
    }
  };

  if (hasError && !todayTimings) {
    return <EmptyState type="error" onRetry={handleRetry} isRetrying={isLoading} />;
  }

  if (isLoading && !todayTimings) {
    return (
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingBottom: 16,
          paddingTop: 10,
        }}
        showsVerticalScrollIndicator={false}>
        {Array.from({ length: 5 }).map((_, index) => (
          <Box
            key={`prayer-skeleton-${index}`}
            marginHorizontal="$4"
            marginBottom="$3"
            padding="$4"
            borderRadius="$6"
            backgroundColor="$backgroundSecondary">
            <VStack gap="$3">
              <HStack justifyContent="space-between" alignItems="center">
                <SkeletonText style={{ height: 20, width: 64 }} />
                <Skeleton variant="circular" style={{ height: 24, width: 24 }} />
              </HStack>

              <VStack alignItems="center" gap="$2">
                <SkeletonText style={{ height: 32, width: 80 }} />
                <SkeletonText style={{ height: 12, width: 48 }} />
              </VStack>

              <Box alignItems="center">
                <Skeleton variant="rounded" style={{ height: 24, width: 64 }} />
              </Box>
            </VStack>
          </Box>
        ))}
      </ScrollView>
    );
  }

  return (
    todayTimings && (
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
    )
  );
};

export default PrayerTimesList;
