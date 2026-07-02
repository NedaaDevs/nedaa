import { useEffect, useRef } from "react";

// Components
import { Box } from "@/components/ui/box";
import { Background } from "@/components/ui/background";
import Header from "@/components/Header";
import TimingsCarousel from "@/components/TimingsCarousel";
import ActiveAlarmBanner from "@/components/ActiveAlarmBanner";
import FeatureDiscoveryCard from "@/components/tools/FeatureDiscoveryCard";
import ImportantDaysCard from "@/components/ImportantDaysCard";
import { FeatureCardId } from "@/constants/FeatureCards";
import UmrahResumeBanner from "@/components/umrah/UmrahResumeBanner";
import KaabaIcon from "@/components/umrah/icons/KaabaIcon";
import { BookOpen, CalendarDays } from "lucide-react-native";

// Stores
import { useAppStore } from "@/stores/app";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { useUmrahGuideStore } from "@/stores/umrahGuide";

// Hooks
import { useAppVisibility } from "@/hooks/useAppVisibility";
import { ensureAlarmsScheduled } from "@/utils/alarmScheduler";

const IMPORTANT_DAYS_CARD = {
  id: FeatureCardId.IMPORTANT_DAYS,
  titleKey: "importantDays.featureCard.title",
  descriptionKey: "importantDays.featureCard.description",
  ctaKey: "importantDays.featureCard.explore",
  icon: CalendarDays,
  route: "/important-days",
};

const UMRAH_GUIDE_CARD = {
  id: FeatureCardId.UMRAH,
  titleKey: "umrah.featureCard.title",
  descriptionKey: "umrah.featureCard.description",
  icon: KaabaIcon,
  route: "/umrah",
};

// TODO(quran-gate): the quranUnlocked guard goes away at 2.10.0 (feature public).
const QURAN_FEATURE_CARD = {
  id: FeatureCardId.QURAN,
  titleKey: "quran.featureCard.title",
  descriptionKey: "quran.featureCard.description",
  ctaKey: "quran.featureCard.explore",
  icon: BookOpen,
  route: "/(tabs)/quran",
};

export default function MainScreen() {
  const { mode, quranUnlocked, dismissedFeatureCards } = useAppStore();
  const { loadPrayerTimes } = usePrayerTimesStore();
  const { becameActiveAt } = useAppVisibility();
  const activeProgress = useUmrahGuideStore((s) => s.activeProgress);
  const isFirstMount = useRef(true);

  // First eligible undismissed announcement (cards never stack).
  const featureCard = [
    ...(quranUnlocked ? [QURAN_FEATURE_CARD] : []),
    IMPORTANT_DAYS_CARD,
    ...(activeProgress ? [] : [UMRAH_GUIDE_CARD]),
  ].find((card) => !dismissedFeatureCards.includes(card.id));

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

        {/* One announcement at a time: the first eligible undismissed card.
            TODO(quran-gate): remove the quranUnlocked guard at 2.10.0 */}
        {featureCard && <FeatureDiscoveryCard config={featureCard} />}

        {activeProgress && <UmrahResumeBanner />}

        <ImportantDaysCard />

        <Box flex={1}>
          <TimingsCarousel mode={mode} />
        </Box>
      </Box>
    </Background>
  );
}
