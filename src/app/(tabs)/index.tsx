import { useSafeAreaInsets } from "react-native-safe-area-context";

// Components
import { Box } from "@/components/ui/box";
import { SkyBackground } from "@/components/ui/sky-background";
import { CelestialRhythm } from "@/components/today/CelestialRhythm";
import { DaySimulator, DaySimulatorButton } from "@/components/today/DaySimulator";
import { PrayerTimesState } from "@/components/today/PrayerTimesState";
import { TodayHeader } from "@/components/today/TodayHeader";
import ActiveAlarmBanner from "@/components/ActiveAlarmBanner";
import UmrahResumeBanner from "@/components/umrah/UmrahResumeBanner";

// Hooks
import { useTabBarInset } from "@/hooks/useTabBarInset";

// Stores
import { useUmrahGuideStore } from "@/stores/umrahGuide";

export default function MainScreen() {
  const activeProgress = useUmrahGuideStore((s) => s.activeProgress);
  const insets = useSafeAreaInsets();
  const tabBarInset = useTabBarInset();

  return (
    <DaySimulator>
      <SkyBackground>
        {/* The sky runs under both bars; the content sits between them. */}
        <Box flex={1} paddingTop={insets.top} paddingBottom={tabBarInset}>
          <ActiveAlarmBanner />
          <Box paddingHorizontal="$4" paddingTop="$2" gap="$3">
            <TodayHeader />
            <CelestialRhythm />
            <PrayerTimesState />
            <DaySimulatorButton />
          </Box>

          {activeProgress && <UmrahResumeBanner />}
        </Box>
      </SkyBackground>
    </DaySimulator>
  );
}
