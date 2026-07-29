import { ScrollView } from "react-native";

// Components
import TimingItem from "@/components/TimingItem";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { Box } from "@/components/ui/box";
import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { EmptyState } from "@/components/feedback";

// Icons
import { Sun, Sunset, Sunrise, Moon, CloudSun } from "lucide-react-native";

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
  asr: CloudSun,
  maghrib: Sunset,
  isha: Moon,
};

const PrayerTimesList = () => {
  const { todayTimings, hasError, isLoading, getNextPrayer, loadPrayerTimes, clearError } =
    usePrayerTimesStore();
  const nextPrayer = todayTimings ? getNextPrayer() : null;
  const screenshotSeed = useScreenshotSeed("prayer-times");
  const displayNextPrayerName: string | null = screenshotSeed?.nextPrayer
    ? screenshotSeed.nextPrayer.toLowerCase()
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
        <Card variant="grouped" marginHorizontal="$4">
          {Array.from({ length: 5 }).map((_, index) => (
            <Box key={`prayer-skeleton-${index}`}>
              <HStack padding="$4" justifyContent="space-between" alignItems="center">
                <HStack alignItems="center" gap="$3">
                  <Skeleton variant="circular" style={{ height: 18, width: 18 }} />
                  <SkeletonText style={{ height: 20, width: 72 }} />
                </HStack>
                <SkeletonText style={{ height: 20, width: 64 }} />
              </HStack>
              {index < 4 && <Card.Divider marginStart={46} />}
            </Box>
          ))}
        </Card>
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
        <Card variant="grouped" marginHorizontal="$4">
          {Object.entries(todayTimings.timings).map(([prayer, time], index, rows) => {
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
                showDivider={index < rows.length - 1}
              />
            );
          })}
        </Card>
      </ScrollView>
    )
  );
};

export default PrayerTimesList;
