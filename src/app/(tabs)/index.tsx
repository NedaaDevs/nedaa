import { useSafeAreaInsets } from "react-native-safe-area-context";

// Components
import { Box } from "@/components/ui/box";
import { SkyBackground } from "@/components/ui/sky-background";
import { TodayHeader } from "@/components/today/TodayHeader";
import ActiveAlarmBanner from "@/components/ActiveAlarmBanner";
import UmrahResumeBanner from "@/components/umrah/UmrahResumeBanner";

// Stores
import { useUmrahGuideStore } from "@/stores/umrahGuide";

export default function MainScreen() {
  const activeProgress = useUmrahGuideStore((s) => s.activeProgress);
  const insets = useSafeAreaInsets();

  return (
    <SkyBackground>
      {/* The sky runs under the status bar, so the content starts below it. */}
      <Box flex={1} paddingTop={insets.top}>
        <ActiveAlarmBanner />
        <Box paddingHorizontal="$4" paddingTop="$2" gap="$3">
          <TodayHeader />
        </Box>

        {activeProgress && <UmrahResumeBanner />}
      </Box>
    </SkyBackground>
  );
}
