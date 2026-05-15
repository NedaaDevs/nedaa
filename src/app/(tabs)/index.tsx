import { useEffect, useRef } from "react";

// Components
import { Box } from "@/components/ui/box";
import { Background } from "@/components/ui/background";
import Header from "@/components/Header";
import TimingsCarousel from "@/components/TimingsCarousel";
import ActiveAlarmBanner from "@/components/ActiveAlarmBanner";
import FeatureDiscoveryCard from "@/components/tools/FeatureDiscoveryCard";
import UmrahResumeBanner from "@/components/umrah/UmrahResumeBanner";
import KaabaIcon from "@/components/umrah/icons/KaabaIcon";

// Stores
import { useAppStore } from "@/stores/app";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { useUmrahGuideStore } from "@/stores/umrahGuide";

// Hooks
import { useAppVisibility } from "@/hooks/useAppVisibility";
import { ensureAlarmsScheduled } from "@/utils/alarmScheduler";
import { useScreenshotSeed } from "@/screenshot-mode/useScreenshotSeed";

const UMRAH_GUIDE_CARD = {
  id: "umrah-guide-v1",
  titleKey: "umrah.featureCard.title",
  descriptionKey: "umrah.featureCard.description",
  icon: KaabaIcon,
  route: "/umrah",
};

export default function MainScreen() {
  const { mode } = useAppStore();
  const { loadPrayerTimes } = usePrayerTimesStore();
  const { becameActiveAt } = useAppVisibility();
  const activeProgress = useUmrahGuideStore((s) => s.activeProgress);
  const isFirstMount = useRef(true);

  // Screenshot mode: read seed for this screen. In production builds
  // (EXPO_PUBLIC_SCREENSHOT_MODE unset) this always returns null and behavior is unchanged.
  // display* values are prop-drilled into Header / TimingsCarousel.
  const screenshotSeed = useScreenshotSeed("prayer-times");
  const displayLocation = screenshotSeed?.location ?? null;
  const displayNow = screenshotSeed?.frozenNow ?? Date.now();
  const displayNextPrayer = screenshotSeed?.nextPrayer ?? null;
  void displayLocation;
  void displayNow;
  void displayNextPrayer;

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    loadPrayerTimes().then(() => ensureAlarmsScheduled());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [becameActiveAt]);

  return (
    <Background>
      <Box flex={1}>
        <ActiveAlarmBanner />
        <Box>
          <Header />
        </Box>

        {activeProgress ? (
          <UmrahResumeBanner />
        ) : (
          <FeatureDiscoveryCard config={UMRAH_GUIDE_CARD} />
        )}

        <Box flex={1}>
          <TimingsCarousel mode={mode} />
        </Box>
      </Box>
    </Background>
  );
}
