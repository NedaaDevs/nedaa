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
import { UpcomingOccasions } from "@/components/today/UpcomingOccasions";
import ActiveAlarmBanner from "@/components/ActiveAlarmBanner";
import { PrayerDetailSheet } from "@/components/prayer-detail/PrayerDetailSheet";

// Hooks
import { usePrayerDetail } from "@/hooks/usePrayerDetail";
import { useTabBarInset } from "@/hooks/useTabBarInset";

// Stores
import { usePreferencesStore } from "@/stores/preferences";

export default function MainScreen() {
  const insets = useSafeAreaInsets();
  const tabBarInset = useTabBarInset();
  const showOccasions = usePreferencesStore((state) => state.showImportantDaysOnHome);
  // A card opens its prayer's sheet; the card and its mark on the line stay lit.
  const detail = usePrayerDetail();

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
                <CelestialRhythm selected={detail.prayerId} />
              </SkyOccluder>
              <SkyOccluder>
                <LocationNotice />
              </SkyOccluder>
              <PrayerGrid selected={detail.prayerId} onSelect={detail.open} />
              <OtherTimes />
              <PrayerTimesState />
              {showOccasions ? <UpcomingOccasions /> : null}
              <DaySimulatorButton />
            </Box>
          </SkyScrollView>
        </Box>
        <PrayerDetailSheet
          prayerId={detail.prayerId}
          onClose={detail.close}
          finalFocusRef={detail.openerRef}
        />
      </SkyBackground>
    </DaySimulator>
  );
}
