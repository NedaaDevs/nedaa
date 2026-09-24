import { useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Components
import { Box } from "@/components/ui/box";
import { SkyBackground, SkyOccluder, SkyScrollView } from "@/components/ui/sky-background";
import { CelestialRhythm } from "@/components/today/CelestialRhythm";
import { DaySimulator, DaySimulatorButton } from "@/components/today/DaySimulator";
import { FocusCountdown } from "@/components/today/FocusCountdown";
import { LocationNotice } from "@/components/today/LocationNotice";
import { OtherTimes } from "@/components/today/OtherTimes";
import { PrayerGrid } from "@/components/today/PrayerGrid";
import { PrayerTimesState } from "@/components/today/PrayerTimesState";
import { TodayHeader } from "@/components/today/TodayHeader";
import ActiveAlarmBanner from "@/components/ActiveAlarmBanner";

// Constants
import type { PrayerId } from "@/constants/Prayer";

// Hooks
import { useTabBarInset } from "@/hooks/useTabBarInset";

export default function MainScreen() {
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
          <SkyScrollView
            contentContainerStyle={{ paddingBottom: tabBarInset }}
            showsVerticalScrollIndicator={false}>
            <Box paddingHorizontal="$4" paddingTop="$2" gap="$3">
              <TodayHeader />
              <FocusCountdown />
              <SkyOccluder>
                <CelestialRhythm selected={selected} />
              </SkyOccluder>
              <SkyOccluder>
                <LocationNotice />
              </SkyOccluder>
              <PrayerGrid selected={selected} onSelect={choose} />
              <OtherTimes />
              <PrayerTimesState />
              <DaySimulatorButton />
            </Box>
          </SkyScrollView>
        </Box>
      </SkyBackground>
    </DaySimulator>
  );
}
