// Components
import { Box } from "@/components/ui/box";
import { SkyBackground } from "@/components/ui/sky-background";
import Header from "@/components/Header";
import { CelestialRhythm } from "@/components/today/CelestialRhythm";
import TimingsCarousel from "@/components/TimingsCarousel";
import ActiveAlarmBanner from "@/components/ActiveAlarmBanner";
import ImportantDaysCard from "@/components/ImportantDaysCard";
import UmrahResumeBanner from "@/components/umrah/UmrahResumeBanner";

// Stores
import { useAppStore } from "@/stores/app";
import { useUmrahGuideStore } from "@/stores/umrahGuide";

export default function MainScreen() {
  const { mode } = useAppStore();
  const activeProgress = useUmrahGuideStore((s) => s.activeProgress);

  return (
    <SkyBackground>
      <Box flex={1}>
        <ActiveAlarmBanner />
        <Box>
          <Header />
        </Box>

        <Box paddingHorizontal="$4" paddingBottom="$2">
          <CelestialRhythm />
        </Box>

        {activeProgress && <UmrahResumeBanner />}

        <ImportantDaysCard />

        <Box flex={1}>
          <TimingsCarousel mode={mode} />
        </Box>
      </Box>
    </SkyBackground>
  );
}
