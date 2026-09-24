import { useState } from "react";
import { ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Components
import { Box } from "@/components/ui/box";
import { SkyBackground } from "@/components/ui/sky-background";
import { CelestialRhythm } from "@/components/today/CelestialRhythm";
import { DaySimulator, DaySimulatorButton } from "@/components/today/DaySimulator";
import { FocusCountdown } from "@/components/today/FocusCountdown";
import { OtherTimes } from "@/components/today/OtherTimes";
import { PrayerGrid } from "@/components/today/PrayerGrid";
import { PrayerTimesState } from "@/components/today/PrayerTimesState";
import { TodayHeader } from "@/components/today/TodayHeader";
import ActiveAlarmBanner from "@/components/ActiveAlarmBanner";
import UmrahResumeBanner from "@/components/umrah/UmrahResumeBanner";

// Constants
import type { PrayerId } from "@/constants/Prayer";

// Hooks
import { useTabBarInset } from "@/hooks/useTabBarInset";

// Stores
import { useUmrahGuideStore } from "@/stores/umrahGuide";

export default function MainScreen() {
  const activeProgress = useUmrahGuideStore((s) => s.activeProgress);
  const insets = useSafeAreaInsets();
  const tabBarInset = useTabBarInset();
  // Chosen on a card, lit on the day's line; choosing it again clears it.
  const [selected, setSelected] = useState<PrayerId>();
  const choose = (id: PrayerId) => setSelected((current) => (current === id ? undefined : id));

  return (
    <DaySimulator>
      <SkyBackground>
        {/* The sky runs under both bars; the content scrolls clear of the tab bar. */}
        <Box flex={1} paddingTop={insets.top}>
          <ActiveAlarmBanner />
          <ScrollView
            contentContainerStyle={{ paddingBottom: tabBarInset }}
            showsVerticalScrollIndicator={false}>
            <Box paddingHorizontal="$4" paddingTop="$2" gap="$3">
              <TodayHeader />
              <FocusCountdown />
              <CelestialRhythm selected={selected} />
              <PrayerGrid selected={selected} onSelect={choose} />
              <OtherTimes />
              <PrayerTimesState />
              <DaySimulatorButton />
            </Box>

            {activeProgress && <UmrahResumeBanner />}
          </ScrollView>
        </Box>
      </SkyBackground>
    </DaySimulator>
  );
}
