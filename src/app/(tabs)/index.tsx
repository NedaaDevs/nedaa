import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useIsFocused } from "expo-router";

// Components
import { Box } from "@/components/ui/box";
import { ScreenContent } from "@/components/ui/screen-content";
import { SkyBackground, SkyOccluder, SkyScrollView } from "@/components/ui/sky-background";
import { VStack } from "@/components/ui/vstack";
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

// Constants
import { TODAY_SCREEN_PART } from "@/constants/Today";

// Hooks
import { usePrayerDetail } from "@/hooks/usePrayerDetail";
import { useTabBarInset } from "@/hooks/useTabBarInset";

// Stores
import { usePreferencesStore } from "@/stores/preferences";

export default function MainScreen() {
  const focused = useIsFocused();
  const insets = useSafeAreaInsets();
  const tabBarInset = useTabBarInset();
  const showOccasions = usePreferencesStore((state) => state.showImportantDaysOnHome);
  // A card opens its prayer's sheet; the card and its mark on the line stay lit.
  const detail = usePrayerDetail();

  return (
    <DaySimulator>
      <SkyBackground paused={!focused}>
        {/* The sky runs under both bars; the content scrolls clear of the tab bar. */}
        <Box flex={1} paddingTop={insets.top}>
          <ActiveAlarmBanner />
          <SkyScrollView
            contentContainerStyle={{ paddingBottom: tabBarInset }}
            showsVerticalScrollIndicator={false}>
            {/* More air around the date and the prayer; the day below sits closer. */}
            <ScreenContent testID={TODAY_SCREEN_PART.CONTENT} paddingTop="$2" gap="$heroGap">
              <TodayHeader />
              {/* The arc sits close under the countdown it belongs to. */}
              <VStack testID={TODAY_SCREEN_PART.FOCUS} gap="$2.5">
                <FocusCountdown paused={!focused} />
                <Box testID={TODAY_SCREEN_PART.DAY} gap="$3.5">
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
              </VStack>
            </ScreenContent>
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
