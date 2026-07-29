import { ScrollView } from "react-native";

// Components
import TimingItem from "@/components/TimingItem";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { EmptyState } from "@/components/feedback";
import { useMinuteClock } from "@/hooks/useMinuteClock";

// Icons
import { Sun, Sunset, Sunrise, Moon } from "lucide-react-native";

// Utils
import { isFriday } from "@/utils/date";

// Types
import { PrayerName } from "@/types/prayerTimes";

// Stores
import { usePrayerTimesStore } from "@/stores/prayerTimes";

// Screenshot mode
import { useScreenshotSeed } from "@/screenshot-mode/useScreenshotSeed";

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
  const now = useMinuteClock();
  const nextPrayer = todayTimings ? getNextPrayer(now) : null;
  // Past Isha, getNextPrayer rolls over to tomorrow's Fajr. Highlighting today's
  // first row would be wrong, so nothing is marked next.
  const nextIsTomorrow = !!nextPrayer && !!todayTimings && nextPrayer.date !== todayTimings.date;
  const screenshotSeed = useScreenshotSeed("prayer-times");
  const displayNextPrayerName: string | null = screenshotSeed?.nextPrayer
    ? screenshotSeed.nextPrayer.toLowerCase()
    : nextIsTomorrow
      ? null
      : (nextPrayer?.name ?? null);

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
          <Card key={`prayer-skeleton-${index}`} margin="$2" borderRadius="$4">
            <HStack justifyContent="space-between" alignItems="center">
              <HStack alignItems="center" gap="$3">
                <Skeleton variant="circular" style={{ height: 24, width: 24 }} />
                <SkeletonText style={{ height: 24, width: 72 }} />
              </HStack>
              <SkeletonText style={{ height: 24, width: 72 }} />
            </HStack>
          </Card>
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
          const isNext = displayNextPrayerName === prayer;
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
