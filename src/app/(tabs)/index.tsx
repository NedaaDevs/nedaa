import { useEffect, useRef } from "react";

// Components
import { Box } from "@/components/ui/box";
import { Background } from "@/components/ui/background";
import Header from "@/components/Header";
import TimingsCarousel from "@/components/TimingsCarousel";
import ActiveAlarmBanner from "@/components/ActiveAlarmBanner";

// Stores
import { useAppStore } from "@/stores/app";
import { usePrayerTimesStore } from "@/stores/prayerTimes";

// Hooks
import { useAppVisibility } from "@/hooks/useAppVisibility";
import { ensureAlarmsScheduled } from "@/utils/alarmScheduler";

export default function MainScreen() {
  const { mode } = useAppStore();
  const { loadPrayerTimes } = usePrayerTimesStore();
  const { becameActiveAt } = useAppVisibility();
  const isFirstMount = useRef(true);

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

        <Box flex={1}>
          <TimingsCarousel mode={mode} />
        </Box>
      </Box>
    </Background>
  );
}
