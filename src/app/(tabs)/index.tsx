import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useIsFocused } from "expo-router";

// Components
import { Box } from "@/components/ui/box";
import { ScreenContent } from "@/components/ui/screen-content";
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

// Constants
import { FOCUS_LAYOUT } from "@/constants/Countdown";
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
      {/* The bowl draws Today's sun and moon; the sky keeps none of its own. */}
      <SkyBackground paused={!focused} bodies={false}>
        {/* The sky runs under both bars; the content scrolls clear of the tab bar. */}
        <Box flex={1} paddingTop={insets.top}>
          <ActiveAlarmBanner />
          <SkyScrollView
            contentContainerStyle={{ paddingBottom: tabBarInset }}
            showsVerticalScrollIndicator={false}>
            {/* More air around the date and the prayer; the day below sits closer. */}
            <ScreenContent testID={TODAY_SCREEN_PART.CONTENT} paddingTop="$2" gap="$heroGap">
              <TodayHeader />
              <Box testID={TODAY_SCREEN_PART.DAY} gap="$3.5">
                {/* The countdown sits inside the bowl that draws the day. */}
                <Box testID={TODAY_SCREEN_PART.FOCUS}>
                  <CelestialRhythm selected={detail.prayerId}>
                    <FocusCountdown paused={!focused} layout={FOCUS_LAYOUT.CENTRED} />
                  </CelestialRhythm>
                </Box>
                <SkyOccluder>
                  <LocationNotice />
                </SkyOccluder>
                <PrayerGrid selected={detail.prayerId} onSelect={detail.open} />
                <OtherTimes />
                <PrayerTimesState />
                {showOccasions ? <UpcomingOccasions /> : null}
                <DaySimulatorButton />
              </Box>
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
