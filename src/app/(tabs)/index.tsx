import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useIsFocused } from "expo-router";

// Components
import { Box } from "@/components/ui/box";
import { ScreenContent } from "@/components/ui/screen-content";
import { ScreenSky, SkyOccluder, SkyScrollView } from "@/components/ui/sky-background";
import { DaySimulator, DaySimulatorButton } from "@/components/today/DaySimulator";
import { LocationNotice } from "@/components/today/LocationNotice";
import { OtherTimes } from "@/components/today/OtherTimes";
import { PrayerGrid } from "@/components/today/PrayerGrid";
import { PrayerTimesState } from "@/components/today/PrayerTimesState";
import { TodayHeader } from "@/components/today/TodayHeader";
import { TodayHero } from "@/components/today/TodayHero";
import { UpcomingOccasions } from "@/components/today/UpcomingOccasions";
import ActiveAlarmBanner from "@/components/ActiveAlarmBanner";
import { PrayerDetailSheet } from "@/components/prayer-detail/PrayerDetailSheet";

// Constants
import { DAY_RUN_KIND } from "@/constants/DayRun";
import { TODAY_SCREEN_PART, TODAY_STYLE } from "@/constants/Today";

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
  const todayStyle = usePreferencesStore((state) => state.todayStyle);
  const bowl = todayStyle === TODAY_STYLE.BOWL;
  // A card opens its prayer's sheet; the card and its mark on the line stay lit.
  const detail = usePrayerDetail();

  return (
    <DaySimulator kind={DAY_RUN_KIND.DEBUG}>
      <ScreenSky>
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
                {/* The countdown sits inside the bowl that draws the day, or alone. */}
                <Box testID={TODAY_SCREEN_PART.FOCUS}>
                  <TodayHero todayStyle={todayStyle} selected={detail.prayerId} paused={!focused} />
                </Box>
                <SkyOccluder>
                  <LocationNotice />
                </SkyOccluder>
                <PrayerGrid selected={detail.prayerId} onSelect={detail.open} progress={!bowl} />
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
      </ScreenSky>
    </DaySimulator>
  );
}
